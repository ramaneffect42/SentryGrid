import BaseTransport from './BaseTransport';
import {DEVICE_TYPES} from '../../utils/constants';

class BLETransport extends BaseTransport {
  constructor() {
    super('BLE');
  }

  async startDiscovery() {
    await super.startDiscovery();

    // Placeholder discovery event so the UI has a visible example.
    setTimeout(() => {
      this.emitPeer({
        id: 'ble-demo-peer',
        name: 'BLE Demo Node',
        deviceType: DEVICE_TYPES.PHONE,
        metadata: {
          rssi: -64,
        },
      });
    }, 800);
  }
}

export default BLETransport;
