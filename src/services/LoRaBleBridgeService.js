import {BleManager} from 'react-native-ble-plx';
import {decode as decodeBase64, encode as encodeBase64} from 'base-64';

import logger from '../utils/logger';

const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const RX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const TX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
const DEVICE_NAME_PATTERN = /sentrygrid|esp32|lora/i;

class LoRaBleBridgeService {
  constructor() {
    this.manager = new BleManager();
    this.discoveredDevices = [];
    this.connectedDevice = null;
    this.packetHandler = null;
    this.scanTimer = null;
    this.subscription = null;
    this.buffer = '';
    this.listeners = new Set();
    this.stats = {
      isScanning: false,
      connectedDeviceId: null,
      connectedDeviceName: null,
      txCount: 0,
      rxCount: 0,
      lastActivityAt: null,
      lastPacketPreview: null,
    };
  }

  setPacketHandler(handler) {
    this.packetHandler = handler;
  }

  getDiscoveredDevices() {
    return this.discoveredDevices;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return {
      ...this.stats,
      discoveredDevices: this.discoveredDevices,
    };
  }

  emit() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  async scanForDevices(scanDurationMs = 6000) {
    this.discoveredDevices = [];
    this.stats.isScanning = true;
    this.emit();

    await this.stopScan();

    return new Promise((resolve, reject) => {
      try {
        this.manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
          if (error) {
            reject(error);
            return;
          }

          if (!device?.id) {
            return;
          }

          if (!DEVICE_NAME_PATTERN.test(device.name || device.localName || '')) {
            return;
          }

          if (this.discoveredDevices.some(item => item.id === device.id)) {
            return;
          }

          this.discoveredDevices = [
            ...this.discoveredDevices,
            {
              id: device.id,
              name: device.name || device.localName || 'ESP32 LoRa Bridge',
              rssi: device.rssi ?? null,
            },
          ];
          this.emit();
        });

        this.scanTimer = setTimeout(async () => {
          await this.stopScan();
          resolve(this.discoveredDevices);
        }, scanDurationMs);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stopScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    try {
      this.manager.stopDeviceScan();
    } catch (_error) {
      // Ignore repeated stop calls.
    }

    this.stats.isScanning = false;
    this.emit();
  }

  async connect(deviceId) {
    if (this.connectedDevice?.id === deviceId) {
      return;
    }

    if (this.connectedDevice) {
      await this.disconnect();
    }

    const device = await this.manager.connectToDevice(deviceId, {autoConnect: false});
    const readyDevice = await device.discoverAllServicesAndCharacteristics();

    this.subscription = this.manager.monitorCharacteristicForDevice(
      readyDevice.id,
      SERVICE_UUID,
      TX_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          logger.warn('BLE bridge monitor error', error);
          return;
        }

        if (!characteristic?.value) {
          return;
        }

        this.handleIncomingChunk(decodeBase64(characteristic.value));
      },
    );

    this.connectedDevice = readyDevice;
    this.stats.connectedDeviceId = readyDevice.id;
    this.stats.connectedDeviceName = readyDevice.name || readyDevice.localName || 'ESP32 LoRa Bridge';
    this.stats.lastActivityAt = new Date().toISOString();
    this.emit();
    logger.info('Connected to ESP32 BLE LoRa bridge', {deviceId});
  }

  async disconnect() {
    this.subscription?.remove();
    this.subscription = null;

    if (this.connectedDevice) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      } catch (_error) {
        // Ignore disconnection races.
      }
    }

    this.connectedDevice = null;
    this.buffer = '';
    this.stats.connectedDeviceId = null;
    this.stats.connectedDeviceName = null;
    this.emit();
  }

  async isConnected() {
    if (!this.connectedDevice) {
      return false;
    }

    return this.manager.isDeviceConnected(this.connectedDevice.id);
  }

  async write(message) {
    if (!this.connectedDevice) {
      throw new Error('ESP32 BLE bridge is not connected');
    }

    await this.manager.writeCharacteristicWithResponseForDevice(
      this.connectedDevice.id,
      SERVICE_UUID,
      RX_CHARACTERISTIC_UUID,
      encodeBase64(message),
    );
    this.stats.txCount += 1;
    this.stats.lastActivityAt = new Date().toISOString();
    this.stats.lastPacketPreview = message.slice(0, 120);
    this.emit();
  }

  handleIncomingChunk(chunk) {
    this.buffer = `${this.buffer}${chunk}`;
    const parts = this.buffer.split('\n');
    this.buffer = parts.pop() ?? '';

    parts
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(line => {
        try {
          const decoded = JSON.parse(line);

          if (decoded?.kind === 'mesh-packet' && decoded.packet) {
            this.stats.rxCount += 1;
            this.stats.lastActivityAt = new Date().toISOString();
            this.stats.lastPacketPreview = JSON.stringify(decoded.packet).slice(0, 120);
            this.emit();
            this.packetHandler?.(decoded.packet);
            return;
          }

          logger.info('Received non-mesh packet from BLE bridge', decoded);
        } catch (error) {
          logger.warn('Unable to parse BLE bridge payload', {line, error});
        }
      });
  }
}

export const LORA_BLE_SERVICE_UUID = SERVICE_UUID;
export default new LoRaBleBridgeService();
