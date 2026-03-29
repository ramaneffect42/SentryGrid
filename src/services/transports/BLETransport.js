import RNBluetoothClassic from 'react-native-bluetooth-classic';

import BaseTransport from './BaseTransport';
import {DEVICE_TYPES} from '../../utils/constants';
import logger from '../../utils/logger';

const CONNECTION_OPTIONS = {
  CONNECTOR_TYPE: 'rfcomm',
  CONNECTION_TYPE: 'delimited',
  DELIMITER: '\n',
  DEVICE_CHARSET: 'utf-8',
};

const createPacketId = () => `bt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class BLETransport extends BaseTransport {
  constructor() {
    super('Bluetooth');
    this.connectedDevices = new Map();
    this.readSubscriptions = new Map();
    this.discoverySubscription = null;
    this.connectionSubscription = null;
    this.disconnectionSubscription = null;
    this.accepting = false;
    this.running = false;
    this.loraBridgeAddress = null;
  }

  async startDiscovery() {
    await super.startDiscovery();
    this.running = true;
    await this.ensureBluetoothEnabled();
    this.attachModuleListeners();
    await this.loadBondedDevices();
    void this.startAcceptLoop();
    await this.refreshDiscovery();
  }

  async stopDiscovery() {
    this.running = false;
    this.accepting = false;

    try {
      await RNBluetoothClassic.cancelDiscovery();
    } catch (_error) {
      // Ignore if discovery was not active.
    }

    try {
      await RNBluetoothClassic.cancelAccept();
    } catch (_error) {
      // Ignore if accept was not active.
    }

    this.discoverySubscription?.remove();
    this.connectionSubscription?.remove();
    this.disconnectionSubscription?.remove();
    this.discoverySubscription = null;
    this.connectionSubscription = null;
    this.disconnectionSubscription = null;

    this.readSubscriptions.forEach(subscription => subscription.remove());
    this.readSubscriptions.clear();
    this.connectedDevices.clear();

    await super.stopDiscovery();
  }

  async refreshDiscovery() {
    await this.ensureBluetoothEnabled();

    try {
      await RNBluetoothClassic.cancelDiscovery();
    } catch (_error) {
      // Discovery may already be stopped.
    }

    const devices = await RNBluetoothClassic.startDiscovery();
    devices.forEach(device => this.emitPeer(this.toPeer(device, {discovered: true})));
  }

  async connect(peer) {
    await super.connect(peer);
    await this.ensureBluetoothEnabled();

    let device = this.connectedDevices.get(peer.id);

    if (!device) {
      if (!peer.metadata?.bonded) {
        try {
          await RNBluetoothClassic.pairDevice(peer.id);
        } catch (error) {
          logger.warn('Bluetooth pairing failed or already exists', {peerId: peer.id, error});
        }
      }

      device = await RNBluetoothClassic.connectToDevice(peer.id, CONNECTION_OPTIONS);
      this.registerConnectedDevice(device, peer.metadata?.isLoRaBridge === true);
    }

    this.emitPeer(
      this.toPeer(device, {
        connected: true,
        bonded: true,
        isLoRaBridge: peer.metadata?.isLoRaBridge === true || peer.id === this.loraBridgeAddress,
      }),
    );
  }

  async connectLoRaBridge(peer) {
    this.loraBridgeAddress = peer.id;
    await this.connect({
      ...peer,
      metadata: {
        ...(peer.metadata ?? {}),
        isLoRaBridge: true,
      },
    });
  }

  async isDeviceConnected(address) {
    const device = this.connectedDevices.get(address);

    if (device?.isConnected) {
      return device.isConnected();
    }

    return RNBluetoothClassic.isDeviceConnected(address);
  }

  async writeToDevice(address, message) {
    let device = this.connectedDevices.get(address);

    if (!device) {
      device = await RNBluetoothClassic.connectToDevice(address, CONNECTION_OPTIONS);
      this.registerConnectedDevice(device, address === this.loraBridgeAddress);
    }

    await device.write(message, 'utf-8');
  }

  async sendToPeer(address, message) {
    await this.writeToDevice(address, `${JSON.stringify({
      kind: 'mesh-packet',
      packet: message,
    })}\n`);
  }

  async broadcast(message) {
    await super.broadcast(message);

    const payload = JSON.stringify({
      kind: 'mesh-packet',
      packet: message,
    });

    await Promise.all(
      [...this.connectedDevices.values()].map(device =>
        device.write(`${payload}\n`, 'utf-8').catch(error => {
          logger.warn('Bluetooth broadcast failed', {address: device.address, error});
        }),
      ),
    );
  }

  attachModuleListeners() {
    if (!this.discoverySubscription) {
      this.discoverySubscription = RNBluetoothClassic.onDeviceDiscovered(event => {
        this.emitPeer(this.toPeer(event.device, {discovered: true}));
      });
    }

    if (!this.connectionSubscription) {
      this.connectionSubscription = RNBluetoothClassic.onDeviceConnected(event => {
        const device = event.device;

        if (!device) {
          return;
        }

        void RNBluetoothClassic.getConnectedDevice(device.address)
          .then(connectedDevice => {
            this.registerConnectedDevice(
              connectedDevice,
              connectedDevice.address === this.loraBridgeAddress,
            );
          })
          .catch(error => {
            logger.warn('Failed to hydrate connected bluetooth device', {error});
          });
      });
    }

    if (!this.disconnectionSubscription) {
      this.disconnectionSubscription = RNBluetoothClassic.onDeviceDisconnected(event => {
        const address = event.device?.address ?? event.device?.id;

        if (!address) {
          return;
        }

        this.connectedDevices.delete(address);
        this.readSubscriptions.get(address)?.remove();
        this.readSubscriptions.delete(address);
        this.emitPeerLost(address);
      });
    }
  }

  async ensureBluetoothEnabled() {
    const available = await RNBluetoothClassic.isBluetoothAvailable();

    if (!available) {
      throw new Error('Bluetooth is not available on this device');
    }

    const enabled = await RNBluetoothClassic.isBluetoothEnabled();

    if (!enabled) {
      await RNBluetoothClassic.requestBluetoothEnabled();
    }
  }

  async loadBondedDevices() {
    const devices = await RNBluetoothClassic.getBondedDevices();
    devices.forEach(device => this.emitPeer(this.toPeer(device, {bonded: true})));
  }

  async startAcceptLoop() {
    if (this.accepting) {
      return;
    }

    this.accepting = true;

    while (this.running) {
      try {
        const device = await RNBluetoothClassic.accept(CONNECTION_OPTIONS);
        this.registerConnectedDevice(device, device.address === this.loraBridgeAddress);
      } catch (error) {
        if (this.running) {
          logger.warn('Bluetooth accept loop interrupted', error);
        }
      }
    }

    this.accepting = false;
  }

  registerConnectedDevice(device, isLoRaBridge = false) {
    this.connectedDevices.set(device.address, device);
    this.readSubscriptions.get(device.address)?.remove();

    const subscription = device.onDataReceived(event => {
      this.handleIncomingData(device, event.data, isLoRaBridge);
    });

    this.readSubscriptions.set(device.address, subscription);
    this.emitPeer(
      this.toPeer(device, {
        bonded: true,
        connected: true,
        isLoRaBridge,
      }),
    );
  }

  handleIncomingData(device, rawData, isLoRaBridge = false) {
    const chunks = String(rawData)
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);

    chunks.forEach(chunk => {
      try {
        const decoded = JSON.parse(chunk);

        if (decoded?.kind === 'mesh-packet' && decoded.packet) {
          this.emitMessage(decoded.packet);
          return;
        }
      } catch (_error) {
        // Non-JSON data will be treated as long-range text below.
      }

      if (!isLoRaBridge) {
        logger.info('Ignoring non-mesh bluetooth payload', {
          address: device.address,
          sample: chunk.slice(0, 120),
        });
        return;
      }

      this.emitMessage({
        id: createPacketId(),
        senderId: device.name || device.address,
        eventType: 'RELAY',
        message: chunk,
        hopCount: 0,
        maxHops: 5,
        route: [device.address],
        transport: 'Bluetooth',
        metadata: {
          source: 'lora-bridge',
          bridgeAddress: device.address,
        },
        createdAt: new Date().toISOString(),
      });
    });
  }

  toPeer(device, metadata = {}) {
    return {
      id: device.address ?? device.id,
      name: device.name || device.address || 'Unknown Bluetooth Device',
      deviceType:
        metadata.isLoRaBridge || /esp32|lora/i.test(device.name || '')
          ? DEVICE_TYPES.REPEATER
          : DEVICE_TYPES.PHONE,
      metadata: {
        bonded: Boolean(device.bonded ?? metadata.bonded),
        connected: Boolean(metadata.connected),
        discovered: Boolean(metadata.discovered),
        address: device.address ?? device.id,
        type: device.type ?? 'CLASSIC',
        rssi: device.rssi ?? null,
        isLoRaBridge: Boolean(metadata.isLoRaBridge || this.loraBridgeAddress === (device.address ?? device.id)),
      },
    };
  }
}

export default BLETransport;
