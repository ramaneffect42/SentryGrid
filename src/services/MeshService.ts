import {
  Coordinates,
  EmergencyEventType,
  EmergencyLogRecord,
  MeshPeerRecord,
  countUnsyncedEmergencyLogs,
  getAppSetting,
  getMeshPeers,
  getRecentEmergencyLogs,
  hasEmergencyLog,
  initializeDatabase,
  saveEmergencyLog,
  setAppSetting,
  upsertMeshPeer,
} from '../database/Schema';
import logger from '../utils/logger';
import {DEVICE_TYPES} from '../utils/constants';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface MeshPacket {
  id: string;
  senderId: string;
  eventType: EmergencyEventType;
  message: string;
  location?: Coordinates | null;
  hopCount: number;
  maxHops: number;
  route: string[];
  transport: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface MeshTransportDelegate {
  onPeerDiscovered?: (peer: any) => void;
  onPeerLost?: (peerId: string) => void;
  onMessage?: (packet: MeshPacket) => void;
  onTransportState?: (state: unknown) => void;
}

export interface MeshTransport {
  name: string;
  setDelegate: (delegate: MeshTransportDelegate) => void;
  startDiscovery: () => Promise<void>;
  stopDiscovery: () => Promise<void>;
  connect: (peer: MeshPeerRecord) => Promise<void>;
  broadcast: (packet: MeshPacket) => Promise<void>;
  refreshDiscovery?: () => Promise<void>;
  connectLoRaBridge?: (peer: MeshPeerRecord) => Promise<void>;
  isDeviceConnected?: (address: string) => Promise<boolean>;
  writeToDevice?: (address: string, message: string) => Promise<void>;
  sendToPeer?: (address: string, packet: MeshPacket) => Promise<void>;
}

export interface BluetoothSerialAdapter {
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected?(): Promise<boolean>;
  write(message: string): Promise<void>;
}

export interface MeshState {
  deviceId: string;
  displayName: string | null;
  peers: MeshPeerRecord[];
  logs: EmergencyLogRecord[];
  messages: Array<{
    id: string;
    sender: string;
    senderId: string;
    type: EmergencyEventType;
    payload: string;
    timestamp: string;
    via: string[];
    ttl: number;
    deviceType: string;
    receivedFrom?: string;
    metadata?: Record<string, unknown>;
  }>;
  unsyncedCount: number;
  loraConnected: boolean;
  loraBridgeName: string | null;
}

interface MeshServiceOptions {
  deviceId?: string;
  transports?: MeshTransport[];
  maxHops?: number;
}

class MeshService {
  private readonly deviceId: string;
  private readonly transports: MeshTransport[];
  private readonly maxHops: number;
  private readonly subscribers = new Set<(state: MeshState) => void>();
  private readonly seenPacketIds = new Set<string>();
  private peers: MeshPeerRecord[] = [];
  private logs: EmergencyLogRecord[] = [];
  private initialized = false;
  private loraAdapter: BluetoothSerialAdapter | null = null;
  private loraDeviceId: string | null = null;
  private loraBridgeName: string | null = null;
  private displayName: string | null = null;

  constructor({deviceId, transports = [], maxHops = 5}: MeshServiceOptions = {}) {
    this.deviceId = deviceId ?? `sentrygrid-${createId()}`;
    this.transports = transports;
    this.maxHops = maxHops;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await initializeDatabase();
    const [logs, peers] = await Promise.all([getRecentEmergencyLogs(), getMeshPeers()]);
    this.displayName = await getAppSetting('displayName');

    this.logs = logs;
    this.peers = peers;
    this.logs.forEach(log => this.seenPacketIds.add(log.id));

    this.transports.forEach(transport => {
      transport.setDelegate({
        onPeerDiscovered: peer => void this.handlePeerDiscovered(peer, transport),
        onPeerLost: peerId => this.handlePeerLost(peerId),
        onMessage: packet => void this.handleIncomingPacket(packet, transport),
        onTransportState: state =>
          logger.info('Transport state changed', {transport: transport.name, state}),
      });
    });

    await Promise.all(this.transports.map(transport => transport.startDiscovery()));
    this.initialized = true;
    await this.emit();
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.transports.map(transport => transport.stopDiscovery()));
  }

  subscribe(listener: (state: MeshState) => void): () => void {
    this.subscribers.add(listener);
    void this.emit();

    return () => {
      this.subscribers.delete(listener);
    };
  }

  getState(): MeshState {
    return {
      deviceId: this.deviceId,
      displayName: this.displayName,
      peers: this.peers,
      logs: this.logs,
      messages: this.logs.map(log => this.toLegacyMessage(log)),
      unsyncedCount: this.logs.filter(log => log.syncStatus !== 'synced').length,
      loraConnected: Boolean(this.loraAdapter && this.loraDeviceId),
      loraBridgeName: this.loraBridgeName,
    };
  }

  getDisplayName(): string | null {
    return this.displayName;
  }

  async setDisplayName(displayName: string): Promise<void> {
    const trimmed = displayName.trim();

    if (!trimmed) {
      throw new Error('Display name cannot be empty');
    }

    this.displayName = trimmed;
    await setAppSetting('displayName', trimmed);
    await this.emit();
  }

  async connectToPeer(peer: MeshPeerRecord): Promise<void> {
    const transport = this.transports.find(candidate => candidate.name === peer.transport);

    if (!transport) {
      logger.warn('No matching transport found for peer', peer);
      return;
    }

    await transport.connect(peer);
  }

  async broadcastText(message: string, metadata: Record<string, unknown> = {}): Promise<EmergencyLogRecord> {
    const log = this.createLocalLog('TEXT', message, null, metadata);
    await this.persistAndPublish(log);
    await this.broadcastPacket(this.toPacket(log));
    return log;
  }

  async sendTextToPeer(peerId: string, message: string): Promise<EmergencyLogRecord> {
    const peer = this.peers.find(item => item.id === peerId);

    if (!peer) {
      throw new Error('Selected peer is no longer available');
    }

    const transport = this.transports.find(candidate => candidate.name === peer.transport);

    if (!transport || typeof transport.sendToPeer !== 'function') {
      throw new Error(`Direct messaging is not supported on ${peer.transport}`);
    }

    const log = this.createLocalLog('TEXT', message, null, {
      mode: 'direct',
      targetPeerId: peer.id,
      targetPeerName: peer.name ?? peer.id,
    });

    await this.persistAndPublish(log);
    await transport.sendToPeer(peer.id, this.toPacket(log));
    return log;
  }

  async broadcastSOS(options: {
    message?: string;
    location?: Coordinates | null;
    metadata?: Record<string, unknown>;
  } = {}): Promise<EmergencyLogRecord> {
    const message = options.message ?? 'SOS requested from SentryGrid';
    const log = this.createLocalLog('SOS', message, options.location ?? null, {
      priority: 'critical',
      ...options.metadata,
    });

    await this.persistAndPublish(log);
    await this.broadcastPacket(this.toPacket(log));
    return log;
  }

  async refreshDiscovery(): Promise<void> {
    await Promise.all(
      this.transports.map(transport =>
        typeof transport.refreshDiscovery === 'function'
          ? transport.refreshDiscovery()
          : transport.startDiscovery(),
      ),
    );
  }

  async connectLoRaBridge(peer: MeshPeerRecord): Promise<void> {
    const transport = this.transports.find(candidate => candidate.name === peer.transport);

    if (!transport) {
      throw new Error(`No transport available for ${peer.transport}`);
    }

    if (typeof transport.connectLoRaBridge === 'function') {
      await transport.connectLoRaBridge(peer);
    } else {
      await transport.connect(peer);
    }

    if (typeof transport.writeToDevice !== 'function' || typeof transport.isDeviceConnected !== 'function') {
      throw new Error(`${peer.transport} transport does not support LoRa bridge writes`);
    }

    const writeToDevice = transport.writeToDevice;
    const isDeviceConnected = transport.isDeviceConnected;

    this.attachLoRaSerial(
      {
        connect: async deviceId => {
          await transport.connect({
            ...peer,
            id: deviceId,
          });
        },
        disconnect: async () => {
          // The underlying transport manages socket cleanup on shutdown.
        },
        isConnected: () => isDeviceConnected(peer.id),
        write: message => writeToDevice(peer.id, message),
      },
      peer.id,
    );
    this.loraBridgeName = peer.name ?? peer.id;
    await this.emit();
  }

  attachLoRaSerial(adapter: BluetoothSerialAdapter, deviceId: string): void {
    this.loraAdapter = adapter;
    this.loraDeviceId = deviceId;
  }

  async registerLoRaBridge(
    adapter: BluetoothSerialAdapter,
    deviceId: string,
    bridgeName: string | null = null,
  ): Promise<void> {
    this.attachLoRaSerial(adapter, deviceId);
    this.loraBridgeName = bridgeName ?? deviceId;
    await this.emit();
  }

  async connectLoRaSerial(): Promise<void> {
    if (!this.loraAdapter || !this.loraDeviceId) {
      throw new Error('Bluetooth serial adapter not configured');
    }

    await this.loraAdapter.connect(this.loraDeviceId);
    await this.emit();
  }

  async sendLoRaText(message: string): Promise<void> {
    if (!this.loraAdapter) {
      throw new Error('Bluetooth serial adapter not configured');
    }

    if (typeof this.loraAdapter.isConnected === 'function') {
      const connected = await this.loraAdapter.isConnected();

      if (!connected) {
        await this.connectLoRaSerial();
      }
    }

    await this.loraAdapter.write(`${message}\n`);
  }

  async receiveBridgePacket(packet: MeshPacket, transportName = 'LoRa-BLE'): Promise<void> {
    await this.handleIncomingPacket(packet, {name: transportName} as MeshTransport);
  }

  private async handlePeerDiscovered(peer: any, transport: MeshTransport): Promise<void> {
    const normalizedPeer: MeshPeerRecord = {
      id: peer.id,
      name: peer.name ?? peer.id,
      transport: transport.name,
      deviceType: peer.deviceType ?? DEVICE_TYPES.PHONE,
      lastSeen: new Date().toISOString(),
      metadata: peer.metadata ?? {},
    };

    await upsertMeshPeer(normalizedPeer);
    this.peers = this.mergePeer(normalizedPeer);
    await this.emit();
  }

  private handlePeerLost(peerId: string): void {
    this.peers = this.peers.filter(peer => peer.id !== peerId);
    void this.emit();
  }

  private async handleIncomingPacket(packet: MeshPacket, incomingTransport: MeshTransport): Promise<void> {
    if (this.seenPacketIds.has(packet.id) || (await hasEmergencyLog(packet.id))) {
      logger.info('Dropped duplicate mesh packet', {packetId: packet.id});
      return;
    }

    const hopCount = packet.hopCount + 1;
    const route = [...new Set([...(packet.route ?? []), this.deviceId])];
    const receivedLog: EmergencyLogRecord = {
      id: packet.id,
      senderId: packet.senderId,
      eventType: packet.eventType,
      message: packet.message,
      latitude: packet.location?.latitude ?? null,
      longitude: packet.location?.longitude ?? null,
      accuracy: packet.location?.accuracy ?? null,
      altitude: packet.location?.altitude ?? null,
      hopCount,
      maxHops: packet.maxHops,
      transport: incomingTransport.name,
      route,
      syncStatus: 'pending',
      syncedAt: null,
      createdAt: packet.createdAt,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(packet.metadata ?? {}),
        relayedBy: this.deviceId,
      },
    };

    await this.persistAndPublish(receivedLog);

    if (hopCount >= packet.maxHops) {
      logger.info('Max hops reached; skipping relay', {
        packetId: packet.id,
        hopCount,
        maxHops: packet.maxHops,
      });
      return;
    }

    await this.broadcastPacket(
      {
        ...packet,
        hopCount,
        route,
      },
      incomingTransport.name,
    );
  }

  private createLocalLog(
    eventType: EmergencyEventType,
    message: string,
    location: Coordinates | null,
    metadata: Record<string, unknown>,
  ): EmergencyLogRecord {
    const timestamp = new Date().toISOString();

    return {
      id: createId(),
      senderId: this.deviceId,
      eventType,
      message,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      altitude: location?.altitude ?? null,
      hopCount: 0,
      maxHops: this.maxHops,
      transport: 'mesh',
      route: [this.deviceId],
      syncStatus: 'pending',
      syncedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        ...metadata,
        senderName: this.displayName ?? 'Anonymous',
      },
    };
  }

  private async persistAndPublish(log: EmergencyLogRecord): Promise<void> {
    this.seenPacketIds.add(log.id);
    await saveEmergencyLog(log);
    this.logs = [log, ...this.logs.filter(item => item.id !== log.id)].slice(0, 100);
    await this.emit();
  }

  private async broadcastPacket(packet: MeshPacket, excludeTransportName?: string): Promise<void> {
    const transportBroadcasts = this.transports
      .filter(transport => transport.name !== excludeTransportName)
      .map(transport =>
        transport.broadcast({
          ...packet,
          transport: transport.name,
        }),
      );

    const loraBridgeBroadcast =
      this.loraAdapter && excludeTransportName !== 'LoRa-BLE'
        ? this.sendPacketToLoRaBridge(packet)
        : Promise.resolve();

    await Promise.all([...transportBroadcasts, loraBridgeBroadcast]);
  }

  private async sendPacketToLoRaBridge(packet: MeshPacket): Promise<void> {
    if (!this.loraAdapter) {
      return;
    }

    if (typeof this.loraAdapter.isConnected === 'function') {
      const connected = await this.loraAdapter.isConnected();

      if (!connected && this.loraDeviceId) {
        await this.loraAdapter.connect(this.loraDeviceId);
      }
    }

    await this.loraAdapter.write(
      `${JSON.stringify({
        kind: 'mesh-packet',
        packet: {
          ...packet,
          transport: 'LoRa-BLE',
        },
      })}\n`,
    );
  }

  private mergePeer(peer: MeshPeerRecord): MeshPeerRecord[] {
    const byId = new Map(this.peers.map(item => [item.id, item]));
    byId.set(peer.id, peer);
    return [...byId.values()].sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));
  }

  private toPacket(log: EmergencyLogRecord): MeshPacket {
    return {
      id: log.id,
      senderId: log.senderId,
      eventType: log.eventType,
      message: log.message,
      location:
        log.latitude === null || log.longitude === null
          ? null
          : {
              latitude: log.latitude,
              longitude: log.longitude,
              accuracy: log.accuracy,
              altitude: log.altitude,
            },
      hopCount: log.hopCount,
      maxHops: log.maxHops,
      route: log.route,
      transport: log.transport,
      metadata: log.metadata,
      createdAt: log.createdAt,
    };
  }

  private toLegacyMessage(log: EmergencyLogRecord) {
    return {
      id: log.id,
      sender: String(log.metadata?.senderName ?? log.senderId),
      senderId: log.senderId,
      type: log.eventType,
      payload: log.message,
      timestamp: log.createdAt,
      via: log.route,
      ttl: Math.max(log.maxHops - log.hopCount, 0),
      deviceType: DEVICE_TYPES.PHONE,
      receivedFrom: log.transport,
      metadata: log.metadata,
    };
  }

  private async emit(): Promise<void> {
    const unsyncedCount = await countUnsyncedEmergencyLogs();
    const state = {
      ...this.getState(),
      unsyncedCount,
    };

    this.subscribers.forEach(listener => listener(state));
  }
}

export default MeshService;
