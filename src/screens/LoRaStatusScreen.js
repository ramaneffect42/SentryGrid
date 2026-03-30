import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import loraBleBridgeService from '../services/loraBridgeRuntime';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function LoRaStatusScreen() {
  const [meshState, setMeshState] = useState(meshService.getState());
  const [bridgeState, setBridgeState] = useState(loraBleBridgeService.getState());

  useEffect(() => meshService.subscribe(setMeshState), []);
  useEffect(() => loraBleBridgeService.subscribe(setBridgeState), []);

  return (
    <ScreenContainer
      title="LoRa Bridge Status"
      subtitle="Use this screen as your live demo proof that the ESP32 bridge is connected and packets are moving.">
      <View style={styles.card}>
        <Text style={styles.title}>Bridge Link</Text>
        <Text style={styles.value}>{meshState.loraConnected ? 'Connected' : 'Not connected'}</Text>
        <Text style={styles.meta}>
          {meshState.loraBridgeName ? `Bridge: ${meshState.loraBridgeName}` : 'No bridge selected'}
        </Text>
        <Text style={styles.meta}>
          BLE device: {bridgeState.connectedDeviceName || bridgeState.connectedDeviceId || 'None'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Packet Activity</Text>
        <Text style={styles.value}>{bridgeState.txCount} sent / {bridgeState.rxCount} received</Text>
        <Text style={styles.meta}>
          Last activity: {bridgeState.lastActivityAt ? new Date(bridgeState.lastActivityAt).toLocaleString() : 'No activity yet'}
        </Text>
        <Text style={styles.meta}>
          Last packet: {bridgeState.lastPacketPreview || 'No packet preview yet'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Mesh Evidence</Text>
        <Text style={styles.value}>{meshState.logs.length} local logs</Text>
        <Text style={styles.meta}>Pending sync: {meshState.unsyncedCount}</Text>
        <Text style={styles.meta}>
          Latest message: {meshState.logs[0]?.message || 'No messages stored yet'}
        </Text>
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
    marginBottom: 8,
  },
  value: {
    color: APP_COLORS.accent,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});

export default LoRaStatusScreen;
