import MeshService from './MeshService';
import BLETransport from './transports/BLETransport';
import WiFiDirectTransport from './transports/WiFiDirectTransport';

const meshService = new MeshService({
  transports: [new BLETransport(), new WiFiDirectTransport()],
  maxHops: 5,
});

export default meshService;
