import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {APP_COLORS} from '../utils/constants';

function MessageBubble({message}) {
  const path = Array.isArray(message.via) && message.via.length > 0 ? message.via.join(' -> ') : 'direct';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.sender}>{message.sender}</Text>
        <Text style={styles.time}>{new Date(message.timestamp).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.payload}>{message.payload}</Text>
      <Text style={styles.meta}>
        TTL {message.ttl} | Path {path}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sender: {
    color: APP_COLORS.accent,
    fontWeight: '700',
  },
  time: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
  },
  payload: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
  },
});

export default MessageBubble;
