import BaseTransport from './BaseTransport';
import logger from '../../utils/logger';

class WiFiDirectTransport extends BaseTransport {
  constructor() {
    super('WiFiDirect');
  }

  async startDiscovery() {
    await super.startDiscovery();
    logger.info('Wi-Fi Direct transport is not implemented yet');
  }
}

export default WiFiDirectTransport;
