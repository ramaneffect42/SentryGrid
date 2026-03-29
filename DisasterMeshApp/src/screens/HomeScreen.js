import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function HomeScreen({navigation}) {
  const [state, setState] = useState(meshService.getState());

  useEffect(() => meshService.subscribe(setState), []);

  return (
    <ScreenContainer
      title="Mesh Control"
      subtitle="Initialize storage, discover nearby nodes, and keep messages flowing even when the internet is gone.">
      <View style={styles.panel}>
        <Text style={styles.label}>Local node</Text>
        <Text style={styles.value}>{state.deviceId || 'pending initialization'}</Text>
        <Text style={styles.meta}>Peers {state.peers.length} | Cached messages {state.messages.length}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('NearbyDevices')}>
        <Text style={styles.primaryButtonText}>View Nearby Devices</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Chat')}>
        <Text style={styles.secondaryButtonText}>Open Chat</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
