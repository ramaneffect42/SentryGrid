import React, {useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function ChatHistoryScreen() {
  const [state, setState] = useState(meshService.getState());

  useEffect(() => meshService.subscribe(setState), []);

  const logs = useMemo(
    () => [...state.logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [state.logs],
  );

  const clearHistory = () => {
    Alert.alert('Clear history', 'This will erase local chat history on this phone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await meshService.clearChatHistory();
        },
      },
    ]);
  };

  const renderHistoryItem = ({item}) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.type}>{item.eventType}</Text>
        <Text style={[styles.syncBadge, item.syncStatus === 'synced' ? styles.syncBadgeSynced : styles.syncBadgePending]}>
          {item.syncStatus}
        </Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.meta}>Sender: {item.senderId}</Text>
      <Text style={styles.meta}>Created: {new Date(item.createdAt).toLocaleString()}</Text>
      <Text style={styles.meta}>Transport: {item.transport} | Hops: {item.hopCount}/{item.maxHops}</Text>
      <Text style={styles.meta}>Route: {item.route.join(' -> ') || 'direct'}</Text>
      <Text style={styles.jsonLabel}>JSON</Text>
      <Text style={styles.jsonBlock}>{JSON.stringify(item, null, 2)}</Text>
    </View>
  );

  return (
    <ScreenContainer
      title="Chat History"
      subtitle="Local SQLite history for every mesh message, including sync state and raw JSON.">
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>History Summary</Text>
        <Text style={styles.summaryText}>Messages stored locally: {logs.length}</Text>
        <Text style={styles.summaryText}>Pending cloud sync: {state.unsyncedCount}</Text>
        <Pressable style={styles.clearButton} onPress={clearHistory}>
          <Text style={styles.clearButtonText}>Clear History</Text>
        </Pressable>
      </View>

      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={renderHistoryItem}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No local history yet</Text>
            <Text style={styles.emptyText}>Once a message is sent or received, it will appear here with its stored JSON.</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  summaryTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#3b1320',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearButtonText: {
    color: '#fecdd3',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyCard: {
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
  card: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1f3355',
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  type: {
    color: APP_COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  syncBadge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncBadgeSynced: {
    color: APP_COLORS.success,
  },
  syncBadgePending: {
    color: APP_COLORS.warning,
  },
  message: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  jsonLabel: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  jsonBlock: {
    color: '#cbd5e1',
    backgroundColor: '#0b1220',
    borderRadius: 14,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default ChatHistoryScreen;
