import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function ChatMessengerScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState(meshService.getState());
  const [selectedPeerId, setSelectedPeerId] = useState('broadcast');
  const [statusMessage, setStatusMessage] = useState('Ready');
  const listRef = useRef(null);

  useEffect(() => meshService.subscribe(setState), []);

  const connectedPeers = useMemo(
    () => state.peers.filter(peer => peer.metadata?.connected),
    [state.peers],
  );

  const currentTargetLabel =
    selectedPeerId === 'broadcast'
      ? 'Broadcast'
      : connectedPeers.find(peer => peer.id === selectedPeerId)?.name || 'Selected peer';

  const orderedMessages = useMemo(
    () => [...state.messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    [state.messages],
  );

  const showUserFeedback = message => {
    setStatusMessage(message);

    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({animated: true});
    });
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
            ? 'Saved on this phone. No connected Bluetooth peers yet.'
            : 'Sent to mesh and saved locally.',
        );
      } else {
        await meshService.sendTextToPeer(selectedPeerId, trimmed);
        showUserFeedback(`Sent to ${currentTargetLabel} and saved locally.`);
      }

      setDraft('');
      setTimeout(scrollToBottom, 120);
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
      showUserFeedback('Forwarded to the ESP32 LoRa bridge.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to write to the ESP32 bridge.';
      showUserFeedback(message);
      Alert.alert('LoRa bridge unavailable', message);
    }
  };

  const renderMessage = ({item}) => {
    const isOwnMessage = item.senderId === state.deviceId;
    const targetPeerName = item.metadata?.targetPeerName;

    return (
      <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming]}>
          <Text style={[styles.senderLine, isOwnMessage && styles.senderLineOutgoing]}>
            {isOwnMessage ? `${state.displayName || 'You'} (You)` : item.sender}
          </Text>
          <Text style={[styles.messageText, isOwnMessage && styles.messageTextOutgoing]}>{item.payload}</Text>
          <Text style={[styles.messageMeta, isOwnMessage && styles.messageMetaOutgoing]}>
            {new Date(item.timestamp).toLocaleTimeString()}
            {item.metadata?.mode === 'direct' && targetPeerName ? `  to ${targetPeerName}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 84}>
        <View style={[styles.headerCard, {marginTop: 12}]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerName}>{currentTargetLabel}</Text>
              <Text style={styles.headerStatus}>
                {connectedPeers.length} connected peer{connectedPeers.length === 1 ? '' : 's'} | Pending sync {state.unsyncedCount}
              </Text>
            </View>
            <Pressable style={styles.historyButton} onPress={() => navigation.navigate('ChatHistory')}>
              <Text style={styles.historyButtonText}>History</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.targetStrip}>
            <Pressable
              style={[styles.targetChip, selectedPeerId === 'broadcast' && styles.targetChipActive]}
              onPress={() => setSelectedPeerId('broadcast')}>
              <Text style={[styles.targetChipText, selectedPeerId === 'broadcast' && styles.targetChipTextActive]}>
                Broadcast
              </Text>
            </Pressable>

            {connectedPeers.map(peer => (
              <Pressable
                key={peer.id}
                style={[styles.targetChip, selectedPeerId === peer.id && styles.targetChipActive]}
                onPress={() => setSelectedPeerId(peer.id)}>
                <Text style={[styles.targetChipText, selectedPeerId === peer.id && styles.targetChipTextActive]}>
                  {peer.name || peer.id}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={orderedMessages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          keyboardShouldPersistTaps="handled"
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Send a message and it will appear here immediately.</Text>
            </View>
          }
        />

        <View style={[styles.composerShell, {paddingBottom: Math.max(insets.bottom, 10)}]}>
          <View style={styles.composerCard}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor={APP_COLORS.textSecondary}
              style={styles.input}
              multiline
              textAlignVertical="top"
              onFocus={scrollToBottom}
            />
            <View style={styles.composerActions}>
              <Pressable style={styles.sendButton} onPress={sendMessage}>
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
              <Pressable
                style={[styles.loraButton, !state.loraConnected && styles.disabledButton]}
                onPress={sendViaLoRa}
                disabled={!state.loraConnected}>
                <Text style={styles.loraButtonText}>LoRa</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  headerCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  headerName: {
    color: APP_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  headerStatus: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyButtonText: {
    color: APP_COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  targetStrip: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  targetChip: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#27406c',
  },
  targetChipActive: {
    backgroundColor: APP_COLORS.accent,
    borderColor: APP_COLORS.accent,
  },
  targetChipText: {
    color: APP_COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  targetChipTextActive: {
    color: '#082032',
  },
  statusMessage: {
    color: APP_COLORS.success,
    fontSize: 13,
    lineHeight: 18,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyState: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1f3355',
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
    marginBottom: 10,
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
    paddingVertical: 10,
  },
  messageBubbleIncoming: {
    backgroundColor: APP_COLORS.panel,
    borderTopLeftRadius: 6,
  },
  messageBubbleOutgoing: {
    backgroundColor: APP_COLORS.accent,
    borderTopRightRadius: 6,
  },
  senderLine: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  senderLineOutgoing: {
    color: '#164e63',
  },
  messageText: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextOutgoing: {
    color: '#082032',
  },
  messageMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'right',
  },
  messageMetaOutgoing: {
    color: '#164e63',
  },
  composerShell: {
    backgroundColor: APP_COLORS.background,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: APP_COLORS.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1f3355',
    padding: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 18,
    marginRight: 10,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: APP_COLORS.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 8,
  },
  sendButtonText: {
    color: '#082032',
    fontWeight: '800',
    fontSize: 15,
  },
  loraButton: {
    backgroundColor: '#173321',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loraButtonText: {
    color: '#d1fae5',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.45,
  },
});

export default ChatMessengerScreen;
