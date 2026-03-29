import meshService from './meshRuntime';
import loraBleBridgeService from './LoRaBleBridgeService';

loraBleBridgeService.setPacketHandler(packet => {
  void meshService.receiveBridgePacket(packet, 'LoRa-BLE');
});

export default loraBleBridgeService;
