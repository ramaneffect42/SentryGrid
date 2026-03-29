import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function ChatScreen({navigation}) {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState(meshService.getState());
  const [selectedPeerId, setSelectedPeerId] = useState('broadcast');
  const [statusMessage, setStatusMessage] = useState('Messages are stored locally and will sync later when the server is reachable.');
  const [lastActionAt, setLastActionAt] = useState(null);
  const listRef = useRef(null);

  useEffect(() => meshService.subscribe(setState), []);

  const connectedPeers = useMemo(
    () => state.peers.filter(peer => peer.metadata?.connected),
    [state.peers],
  );

  const currentTargetLabel =
    selectedPeerId === 'broadcast'
      ? 'All connected mesh peers'
      : connectedPeers.find(peer => peer.id === selectedPeerId)?.name || 'Selected peer';

  const orderedMessages = useMemo(
    () => [...state.messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [state.messages],
  );

  const showUserFeedback = message => {
    setStatusMessage(message);
    setLastActionAt(new Date().toISOString());

    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const sendMessage = async () => {
    const trimmed = draft.trim();

    if (!trimmed) {
      showUserFeedback('Type a message before sending.');
      return;
    }

    try {
      if (selectedPeerId === 'broadcast') {
        await meshService.broadcastText(trimmed, {mode: 'broadcast'});
        showUserFeedback(
          connectedPeers.length === 0
            ? 'Saved on this phone. No connected Bluetooth peers are available yet.'
            : `Saved locally and forwarded to ${connectedPeers.length} connected peer${connectedPeers.length === 1 ? '' : 's'}.`,
        );
      } else {
        await meshService.sendTextToPeer(selectedPeerId, trimmed);
        showUserFeedback(`Saved locally and sent to ${currentTargetLabel}.`);
      }

      setDraft('');
      setTimeout(() => {
        listRef.current?.scrollToEnd?.({animated: true});
      }, 150);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message right now.';
      showUserFeedback(message);
      Alert.alert('Send failed', message);
    }
  };

  const sendViaLoRa = async () => {
    const trimmed = draft.trim();

    if (!trimmed) {
      showUserFeedback('Type a message before sending to the LoRa bridge.');
      return;
    }

    try {
      await meshService.sendLoRaText(trimmed);
      setDraft('');
      showUserFeedback('Message forwarded to the ESP32 LoRa bridge.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to write to the ESP32 bridge.';
      showUserFeedback(message);
      Alert.alert('LoRa bridge unavailable', message);
    }
  };

  const renderMessage = ({item}) => {
    const isOwnMessage = item.sender === state.deviceId;
    const targetPeerName = item.metadata?.targetPeerName;
    const mode = item.metadata?.mode === 'direct' ? 'Direct' : 'Broadcast';

    return (
      <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming]}>
          <Text style={styles.messageMeta}>
            {isOwnMessage ? 'You' : item.sender} • {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
          <Text style={[styles.messageText, isOwnMessage && styles.messageTextOutgoing]}>{item.payload}</Text>
          <Text style={[styles.messageFooter, isOwnMessage && styles.messageFooterOutgoing]}>
            {mode}
            {targetPeerName ? ` to ${targetPeerName}` : ''}
            {' • '}TTL {item.ttl}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer
      title="Mesh Chat"
      subtitle="A simple two-person style chat view backed by local SQLite storage and mesh forwarding."
      scroll={false}>
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 84 : 0}>
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Chat Status</Text>
          <Text style={styles.cardText}>{statusMessage}</Text>
          <Text style={styles.cardMeta}>
            Connected peers {connectedPeers.length} | Pending sync {state.unsyncedCount}
          </Text>
          {lastActionAt ? (
            <Text style={styles.cardMeta}>Last action {new Date(lastActionAt).toLocaleTimeString()}</Text>
          ) : null}
        </View>

        <View style={styles.targetCard}>
          <View style={styles.targetHeader}>
            <View style={styles.targetHeaderCopy}>
              <Text style={styles.cardTitle}>Current Target</Text>
              <Text style={styles.cardText}>{currentTargetLabel}</Text>
            </View>
            <Pressable style={styles.historyButton} onPress={() => navigation.navigate('ChatHistory')}>
              <Text style={styles.historyButtonText}>History</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.targetSelector, selectedPeerId === 'broadcast' && styles.targetSelectorActive]}
            onPress={() => setSelectedPeerId('broadcast')}>
            <Text
              style={[
                styles.targetSelectorText,
                selectedPeerId === 'broadcast' && styles.targetSelectorTextActive,
              ]}>
              Broadcast to all connected peers
            </Text>
          </Pressable>

          {connectedPeers.map(peer => (
            <Pressable
              key={peer.id}
              style={[styles.targetSelector, selectedPeerId === peer.id && styles.targetSelectorActive]}
              onPress={() => setSelectedPeerId(peer.id)}>
              <Text
                style={[
                  styles.targetSelectorText,
                  selectedPeerId === peer.id && styles.targetSelectorTextActive,
                ]}>
                {peer.name || peer.id}
              </Text>
            </Pressable>
          ))}

          {connectedPeers.length === 0 ? (
            <Text style={styles.helperText}>
              No Bluetooth peers are connected yet. Use Nearby Devices to connect another phone first.
            </Text>
          ) : null}
        </View>

        <View style={styles.chatCard}>
          <Text style={styles.cardTitle}>Conversation</Text>
          <FlatList
            ref={listRef}
            data={orderedMessages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            keyboardShouldPersistTaps="handled"
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({animated: true})}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No chat messages yet</Text>
                <Text style={styles.emptyText}>
                  Messages saved on this phone will appear here immediately, even before cloud sync happens.
                </Text>
              </View>
            }
          />
        </View>

        <View style={styles.composerCard}>
          <Text style={styles.cardTitle}>New Message</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message"
            placeholderTextColor={APP_COLORS.textSecondary}
            style={styles.input}
            multiline
            textAlignVertical="top"
          />
          <Pressable style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>{selectedPeerId === 'broadcast' ? 'Send To Mesh' : 'Send To Peer'}</Text>
          </Pressable>
          <Pressable
            style={[styles.loraButton, !state.loraConnected && styles.disabledButton]}
            onPress={sendViaLoRa}
            disabled={!state.loraConnected}>
            <Text style={styles.loraButtonText}>
              {state.loraConnected ? `Send Via ${state.loraBridgeName || 'LoRa Bridge'}` : 'LoRa Bridge Not Connected'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f3355',
    padding: 18,
    marginBottom: 14,
  },
  targetCard: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f3355',
    padding: 18,
    marginBottom: 14,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  targetHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  chatCard: {
    flex: 1,
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f3355',
    paddingTop: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  composerCard: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f3355',
    padding: 18,
  },
  cardTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  cardMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  historyButton: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyButtonText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  targetSelector: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27406c',
  },
  targetSelectorActive: {
    backgroundColor: APP_COLORS.accent,
    borderColor: APP_COLORS.accent,
  },
  targetSelectorText: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  targetSelectorTextActive: {
    color: '#082032',
  },
  helperText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 18,
  },
  emptyState: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 18,
    padding: 18,
    marginTop: 6,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageRowIncoming: {
    alignItems: 'flex-start',
  },
  messageRowOutgoing: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubbleIncoming: {
    backgroundColor: APP_COLORS.panelAlt,
  },
  messageBubbleOutgoing: {
    backgroundColor: APP_COLORS.accent,
  },
  messageMeta: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 6,
  },
  messageText: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextOutgoing: {
    color: '#082032',
  },
  messageFooter: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  messageFooterOutgoing: {
    color: '#164e63',
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#0b1220',
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: APP_COLORS.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  sendButtonText: {
    color: '#082032',
    fontWeight: '800',
    fontSize: 17,
  },
  loraButton: {
    backgroundColor: '#173321',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  loraButtonText: {
    color: '#d1fae5',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
});

export default ChatScreen;
