import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function NearbyDevicesScreen() {
  const [state, setState] = useState(meshService.getState());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => meshService.subscribe(setState), []);

  const bluetoothPeers = useMemo(
    () => state.peers.filter(peer => peer.transport === 'Bluetooth'),
    [state.peers],
  );

  const openScanner = async () => {
    setIsPickerOpen(true);
    setIsScanning(true);

    try {
      await meshService.refreshDiscovery();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <ScreenContainer
      title="Nearby Nodes"
      subtitle="Peers discovered by any active transport surface here in real time.">
      <Pressable style={styles.scanButton} onPress={openScanner}>
        <Text style={styles.scanButtonText}>Scan Bluetooth Devices</Text>
      </Pressable>

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
          <Text style={styles.meta}>
            {peer.metadata?.connected ? 'Connected' : peer.metadata?.bonded ? 'Paired' : 'Discovered only'}
          </Text>
          <Pressable style={styles.button} onPress={() => meshService.connectToPeer(peer)}>
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
          {/esp32|lora/i.test(peer.name || '') ? (
            <Pressable style={styles.bridgeButton} onPress={() => meshService.connectLoRaBridge(peer)}>
              <Text style={styles.bridgeButtonText}>Use As LoRa Bridge</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Modal visible={isPickerOpen} transparent animationType="slide" onRequestClose={() => setIsPickerOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bluetooth Discovery</Text>
              <Pressable onPress={() => setIsPickerOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {isScanning
                ? 'Scanning nearby phones and bridge devices...'
                : 'Tap a device to connect. Pairing may prompt through Android on first contact.'}
            </Text>

            {bluetoothPeers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No Bluetooth devices discovered yet.</Text>
              </View>
            ) : null}

            {bluetoothPeers.map(peer => (
              <Pressable
                key={`modal-${peer.id}`}
                style={styles.modalPeer}
                onPress={() => {
                  void meshService.connectToPeer(peer);
                  setIsPickerOpen(false);
                }}>
                <Text style={styles.modalPeerTitle}>{peer.name || peer.id}</Text>
                <Text style={styles.modalPeerMeta}>{peer.id}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
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
  bridgeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#183018',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bridgeButtonText: {
    color: '#b7f7c2',
    fontWeight: '700',
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    minHeight: '45%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
  },
  closeText: {
    color: APP_COLORS.accent,
    fontWeight: '700',
  },
  modalPeer: {
    backgroundColor: '#111c34',
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#27406c',
  },
  modalPeerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  modalPeerMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

export default NearbyDevicesScreen;
