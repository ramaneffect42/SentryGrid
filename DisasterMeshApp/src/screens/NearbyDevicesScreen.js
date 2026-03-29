import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function NearbyDevicesScreen() {
  const [state, setState] = useState(meshService.getState());

  useEffect(() => meshService.subscribe(setState), []);

  return (
    <ScreenContainer
      title="Nearby Nodes"
      subtitle="Peers discovered by any active transport surface here in real time.">
      {state.peers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No nearby nodes discovered yet.</Text>
        </View>
      ) : null}

      {state.peers.map(peer => (
        <View key={peer.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{peer.name || peer.id}</Text>
            <Text style={styles.transport}>{peer.transport}</Text>
          </View>
          <Text style={styles.meta}>
            Type {peer.deviceType} | Last seen {new Date(peer.lastSeen).toLocaleTimeString()}
          </Text>
          <Pressable style={styles.button} onPress={() => meshService.connectToPeer(peer)}>
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
  },
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
  title: {
    color: APP_COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 17,
  },
  transport: {
    color: APP_COLORS.accent,
    fontWeight: '600',
  },
  meta: {
    color: APP_COLORS.textSecondary,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: APP_COLORS.panelAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: APP_COLORS.textPrimary,
    fontWeight: '600',
  },
});

export default NearbyDevicesScreen;
