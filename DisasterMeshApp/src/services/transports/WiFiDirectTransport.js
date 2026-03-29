import BaseTransport from './BaseTransport';
import {DEVICE_TYPES} from '../../utils/constants';

class WiFiDirectTransport extends BaseTransport {
  constructor() {
    super('WiFiDirect');
  }

  async startDiscovery() {
    await super.startDiscovery();

    // Placeholder discovery event so the UI has a visible example.
    setTimeout(() => {
      this.emitPeer({
        id: 'wifi-demo-repeater',
        name: 'Wi-Fi Direct Repeater',
        deviceType: DEVICE_TYPES.REPEATER,
        metadata: {
          band: '2.4GHz',
        },
      });
    }, 1200);
  }
}

export default WiFiDirectTransport;
