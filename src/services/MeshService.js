import storageService from './StorageService';
import logger from '../utils/logger';
import {DEFAULT_TTL, DEVICE_TYPES, MESSAGE_TYPES} from '../utils/constants';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

class MeshService {
  constructor({deviceId, transports = []} = {}) {
    this.deviceId = deviceId || `phone-${createId()}`;
    this.transports = transports;
    this.subscribers = new Set();
    this.messages = [];
    this.peers = [];
    this.seenMessageIds = new Set();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await storageService.initialize();
    const [storedMessages, storedPeers] = await Promise.all([
      storageService.getMessages(),
      storageService.getPeers(),
    ]);

    this.messages = storedMessages;
    this.peers = storedPeers;
    this.messages.forEach(message => this.seenMessageIds.add(message.id));

    this.transports.forEach(transport => {
      transport.setDelegate({
        onPeerDiscovered: peer => this.handlePeerDiscovered(peer, transport),
        onPeerLost: peerId => this.handlePeerLost(peerId),
        onMessage: packet => this.handleIncomingPacket(packet, transport),
        onTransportState: state => logger.info('Transport state changed', {transport: transport.name, state}),
      });
    });

    await Promise.all(this.transports.map(transport => transport.startDiscovery()));
    this.initialized = true;
    this.emit();
  }

  async shutdown() {
    await Promise.all(this.transports.map(transport => transport.stopDiscovery()));
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    listener(this.getState());

    return () => {
      this.subscribers.delete(listener);
    };
  }

  getState() {
    return {
      deviceId: this.deviceId,
      peers: this.peers,
      messages: this.messages,
    };
  }

  async connectToPeer(peer) {
    const transport = this.transports.find(candidate => candidate.name === peer.transport);

    if (!transport) {
      logger.warn('No matching transport for peer', peer);
      return;
    }

    await transport.connect(peer);
  }

  async broadcastText(payload) {
    const envelope = {
      id: createId(),
      sender: this.deviceId,
      type: MESSAGE_TYPES.TEXT,
      payload,
      ttl: DEFAULT_TTL,
      timestamp: new Date().toISOString(),
      via: [this.deviceId],
      deviceType: DEVICE_TYPES.PHONE,
    };

    await this.persistAndPublish(envelope);
    await this.broadcastEnvelope(envelope);
  }

  async handlePeerDiscovered(peer, transport) {
    const normalizedPeer = {
      id: peer.id,
      name: peer.name ?? peer.id,
      transport: transport.name,
      deviceType: peer.deviceType ?? DEVICE_TYPES.PHONE,
      lastSeen: new Date().toISOString(),
      metadata: peer.metadata ?? {},
    };

    await storageService.upsertPeer(normalizedPeer);
    this.peers = this.mergePeer(normalizedPeer);
    this.emit();
  }

  handlePeerLost(peerId) {
    this.peers = this.peers.filter(peer => peer.id !== peerId);
    this.emit();
  }

  async handleIncomingPacket(packet, transport) {
    const message = {
      ...packet,
      receivedFrom: transport.name,
      via: [...(packet.via ?? []), this.deviceId],
    };

    if (this.seenMessageIds.has(message.id) || (await storageService.hasMessage(message.id))) {
      logger.info('Dropped duplicate mesh packet', {id: message.id});
      return;
    }

    await this.persistAndPublish(message);

    if (message.ttl <= 1) {
      logger.info('Dropped expired message', {id: message.id});
      return;
    }

    const relayedMessage = {
      ...message,
      ttl: message.ttl - 1,
    };

    await this.broadcastEnvelope(relayedMessage, transport.name);
  }

  async persistAndPublish(message) {
    this.seenMessageIds.add(message.id);
    await storageService.saveMessage(message);
    this.messages = [message, ...this.messages].slice(0, 100);
    this.emit();
  }

  async broadcastEnvelope(envelope, excludeTransportName = null) {
    await Promise.all(
      this.transports
        .filter(transport => transport.name !== excludeTransportName)
        .map(transport => transport.broadcast(envelope)),
    );
  }

  mergePeer(peer) {
    const byId = new Map(this.peers.map(item => [item.id, item]));
    byId.set(peer.id, peer);
    return [...byId.values()].sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));
  }

  emit() {
    const state = this.getState();
    this.subscribers.forEach(listener => listener(state));
  }
}

export default MeshService;
