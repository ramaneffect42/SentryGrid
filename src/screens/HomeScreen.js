import React, {useEffect, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import useSync from '../hooks/useSync';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function HomeScreen({navigation}) {
  const [state, setState] = useState(meshService.getState());
  const [isSendingSos, setIsSendingSos] = useState(false);
  const sync = useSync();

  useEffect(() => meshService.subscribe(setState), []);

  const captureCoordinates = () =>
    new Promise(resolve => {
      const geolocation = globalThis?.navigator?.geolocation;

      if (!geolocation) {
        resolve(null);
        return;
      }

      geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 5000,
        },
      );
    });

  const triggerSOS = async () => {
    setIsSendingSos(true);

    try {
      const location = await captureCoordinates();

      await meshService.broadcastSOS({
        message: 'SOS emergency assistance required',
        location,
        metadata: {
          origin: 'dashboard',
          hasGpsFix: Boolean(location),
        },
      });

      Alert.alert(
        'SOS broadcast queued',
        location
          ? `Location attached: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
          : 'GPS was unavailable, so the SOS was sent without coordinates.',
      );
    } catch (error) {
      Alert.alert('SOS failed', error instanceof Error ? error.message : 'Unable to broadcast SOS');
    } finally {
      setIsSendingSos(false);
    }
  };

  return (
    <ScreenContainer
      title="SentryGrid Dashboard"
      subtitle="High-visibility control center for SOS broadcasts, mesh relays, and delayed cloud sync during outages.">
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Emergency Mode</Text>
        <Text style={styles.heroTitle}>Broadcast a distress call across nearby phones, repeaters, and LoRa bridges.</Text>
        <Pressable style={styles.sosButton} onPress={triggerSOS} disabled={isSendingSos}>
          <Text style={styles.sosButtonText}>{isSendingSos ? 'Sending SOS...' : 'Trigger SOS'}</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Local node</Text>
        <Text style={styles.value}>{state.deviceId || 'pending initialization'}</Text>
        <Text style={styles.meta}>Peers {state.peers.length} | Cached logs {state.logs.length}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Mesh Relays</Text>
          <Text style={styles.metricValue}>{state.peers.length}</Text>
          <Text style={styles.metricMeta}>Bluetooth + WiFi Direct peers in range</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending Sync</Text>
          <Text style={styles.metricValue}>{sync.pendingCount}</Text>
          <Text style={styles.metricMeta}>{sync.isOnline ? 'Internet available' : 'Offline caching active'}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>LoRa Bridge</Text>
          <Text style={styles.metricValue}>{state.loraConnected ? 'Linked' : 'Standby'}</Text>
          <Text style={styles.metricMeta}>
            {state.loraConnected && state.loraBridgeName
              ? `Bridge: ${state.loraBridgeName}`
              : 'ESP32 + LoRa via Bluetooth Serial adapter'}
          </Text>
        </View>
      </View>

      <View style={styles.syncCard}>
        <Text style={styles.syncTitle}>Cloud Sync Bridge</Text>
        <Text style={styles.syncText}>
          {sync.isSyncing
            ? 'Bulk-uploading unsynced emergency logs to /api/sync.'
            : sync.error
              ? `Last sync issue: ${sync.error}`
              : sync.lastSyncedAt
                ? `Last cloud sync: ${new Date(sync.lastSyncedAt).toLocaleString()}`
                : 'Waiting for a reachable internet connection.'}
        </Text>
        <Pressable style={styles.primaryButton} onPress={sync.syncNow}>
          <Text style={styles.primaryButtonText}>Sync Now</Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('NearbyDevices')}>
        <Text style={styles.secondaryButtonText}>View Nearby Devices</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Chat')}>
        <Text style={styles.secondaryButtonText}>Open Mesh Console</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#23130f',
    borderRadius: 24,
    padding: 22,
    borderWidth: 2,
    borderColor: '#ff6b2c',
    gap: 14,
  },
  heroEyebrow: {
    color: '#ffd9c7',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff7f2',
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  sosButton: {
    backgroundColor: '#ff5a36',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#fffaf7',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.4,
  },
  panel: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1f3355',
    gap: 10,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: APP_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: APP_COLORS.success,
    fontSize: 14,
  },
  grid: {
    gap: 14,
  },
  metricCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  metricLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#020617',
    fontSize: 28,
    fontWeight: '800',
  },
  metricMeta: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  syncCard: {
    backgroundColor: '#0b1220',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#22406b',
    gap: 12,
  },
  syncTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  syncText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: APP_COLORS.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#082032',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: APP_COLORS.panelAlt,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27406c',
  },
  secondaryButtonText: {
    color: APP_COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default HomeScreen;
