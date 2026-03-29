import React, {useEffect, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import MessageBubble from '../components/MessageBubble';
import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function ChatScreen() {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState(meshService.getState());

  useEffect(() => meshService.subscribe(setState), []);

  const sendMessage = async () => {
    const trimmed = draft.trim();

    if (!trimmed) {
      return;
    }

    await meshService.broadcastText(trimmed);
    setDraft('');
  };

  const sendViaLoRa = async () => {
    const trimmed = draft.trim();

    if (!trimmed) {
      return;
    }

    try {
      await meshService.sendLoRaText(trimmed);
      setDraft('');
      Alert.alert('LoRa bridge', 'Message forwarded to the ESP32 serial bridge.');
    } catch (error) {
      Alert.alert(
        'LoRa bridge unavailable',
        error instanceof Error ? error.message : 'Unable to write to the ESP32 bridge.',
      );
    }
  };

  return (
    <ScreenContainer
      title="Mesh Chat"
      subtitle="Messages are stored locally and relayed across transports using TTL-based forwarding."
      scroll={false}>
      <View style={styles.body}>
        <FlatList
          data={state.messages}
          keyExtractor={item => item.id}
          renderItem={({item}) => <MessageBubble message={item} />}
          contentContainerStyle={styles.list}
        />

        <View style={styles.composer}>
          <Text style={styles.statusText}>
            {state.loraConnected
              ? `LoRa bridge ready: ${state.loraBridgeName || 'ESP32 bridge'}`
              : 'Pair an ESP32 Bluetooth serial device to unlock long-range relay.'}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type an offline message"
            placeholderTextColor={APP_COLORS.textSecondary}
            style={styles.input}
            multiline
          />
          <Pressable style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
          <Pressable
            style={[styles.sendButton, styles.loraButton, !state.loraConnected && styles.disabledButton]}
            onPress={sendViaLoRa}
            disabled={!state.loraConnected}>
            <Text style={styles.loraButtonText}>Send Via LoRa Bridge</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 14,
  },
  list: {
    gap: 12,
    paddingBottom: 12,
  },
  composer: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  input: {
    minHeight: 48,
    color: APP_COLORS.textPrimary,
    fontSize: 16,
  },
  statusText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  sendButtonText: {
    color: '#082032',
    fontWeight: '700',
    fontSize: 15,
  },
  loraButton: {
    backgroundColor: '#214f2d',
  },
  loraButtonText: {
    color: '#dcfce7',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
});

export default ChatScreen;
