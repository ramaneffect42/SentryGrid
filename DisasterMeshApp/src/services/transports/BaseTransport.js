import logger from '../../utils/logger';

class BaseTransport {
  constructor(name) {
    this.name = name;
    this.delegate = null;
  }

  setDelegate(delegate) {
    this.delegate = delegate;
  }

  async startDiscovery() {
    logger.info('Transport discovery started', {transport: this.name});
  }

  async stopDiscovery() {
    logger.info('Transport discovery stopped', {transport: this.name});
  }

  async connect(peer) {
    logger.info('Transport connect requested', {transport: this.name, peerId: peer.id});
  }

  async broadcast(message) {
    logger.info('Transport broadcast requested', {
      transport: this.name,
      messageId: message.id,
      ttl: message.ttl,
    });
  }

  emitPeer(peer) {
    this.delegate?.onPeerDiscovered?.(peer);
  }

  emitPeerLost(peerId) {
    this.delegate?.onPeerLost?.(peerId);
  }

  emitMessage(packet) {
    this.delegate?.onMessage?.(packet);
  }

  emitState(state) {
    this.delegate?.onTransportState?.(state);
  }
}

export default BaseTransport;
