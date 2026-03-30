import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import useSync from '../hooks/useSync';
import {APP_COLORS} from '../utils/constants';

function CloudSyncScreen() {
  const sync = useSync();
  const [serverUrl, setServerUrl] = useState(sync.serverBaseUrl);

  useEffect(() => {
    setServerUrl(sync.serverBaseUrl);
  }, [sync.serverBaseUrl]);

  const saveServerUrl = async () => {
    await sync.setServerBaseUrl(serverUrl);
  };

  return (
    <ScreenContainer
      title="Cloud Sync Setup"
      subtitle="Configure your laptop's Wi-Fi URL here, test Express + MongoDB, and trigger sync without editing code.">
      <View style={styles.card}>
        <Text style={styles.title}>Server URL</Text>
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.x.x:4000"
          placeholderTextColor={APP_COLORS.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.primaryButton} onPress={saveServerUrl}>
          <Text style={styles.primaryButtonText}>Save URL</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Server Health</Text>
        <Text style={styles.meta}>{sync.healthStatus || 'Health has not been checked yet.'}</Text>
        <Pressable style={styles.secondaryButton} onPress={sync.checkServerHealth}>
          <Text style={styles.secondaryButtonText}>Check /health</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sync Queue</Text>
        <Text style={styles.value}>{sync.pendingCount}</Text>
        <Text style={styles.meta}>
          {sync.lastSyncedAt
            ? `Last synced: ${new Date(sync.lastSyncedAt).toLocaleString()}`
            : 'No successful sync yet.'}
        </Text>
        <Text style={styles.meta}>{sync.error ? `Last error: ${sync.error}` : 'No current sync error.'}</Text>
        <Pressable style={styles.primaryButton} onPress={sync.syncNow}>
          <Text style={styles.primaryButtonText}>{sync.isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  value: {
    color: APP_COLORS.accent,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#0b1220',
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: APP_COLORS.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#082032',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: APP_COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default CloudSyncScreen;
