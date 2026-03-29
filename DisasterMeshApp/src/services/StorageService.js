import {open} from 'react-native-quick-sqlite';

import logger from '../utils/logger';

class StorageService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (this.db) {
      return;
    }

    this.db = open('disaster_mesh.db');

    await this.db.executeBatchAsync([
      [
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          sender TEXT NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          ttl INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          via TEXT NOT NULL,
          deviceType TEXT NOT NULL,
          receivedFrom TEXT
        );`,
      ],
      [
        `CREATE TABLE IF NOT EXISTS peers (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          transport TEXT NOT NULL,
          deviceType TEXT NOT NULL,
          lastSeen TEXT NOT NULL,
          metadata TEXT
        );`,
      ],
    ]);

    logger.info('SQLite initialized');
  }

  async saveMessage(message) {
    await this.ensureReady();

    const params = [
      message.id,
      message.sender,
      message.type,
      message.payload,
      message.ttl,
      message.timestamp,
      JSON.stringify(message.via ?? []),
      message.deviceType,
      message.receivedFrom ?? null,
    ];

    await this.db.executeAsync(
      `INSERT OR REPLACE INTO messages
        (id, sender, type, payload, ttl, timestamp, via, deviceType, receivedFrom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      params,
    );
  }

  async getMessages(limit = 50) {
    await this.ensureReady();

    const result = await this.db.executeAsync(
      `SELECT id, sender, type, payload, ttl, timestamp, via, deviceType, receivedFrom
       FROM messages
      ORDER BY timestamp DESC
       LIMIT ?;`,
      [limit],
    );

    return this.normalizeRows(result.rows).map(row => ({
      ...row,
      via: JSON.parse(row.via || '[]'),
    }));
  }

  async upsertPeer(peer) {
    await this.ensureReady();

    const params = [
      peer.id,
      peer.name ?? null,
      peer.transport,
      peer.deviceType,
      peer.lastSeen,
      JSON.stringify(peer.metadata ?? {}),
    ];

    await this.db.executeAsync(
      `INSERT INTO peers (id, name, transport, deviceType, lastSeen, metadata)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         transport = excluded.transport,
         deviceType = excluded.deviceType,
         lastSeen = excluded.lastSeen,
         metadata = excluded.metadata;`,
      params,
    );
  }

  async getPeers() {
    await this.ensureReady();

    const result = await this.db.executeAsync(
      `SELECT id, name, transport, deviceType, lastSeen, metadata
       FROM peers
       ORDER BY lastSeen DESC;`,
    );

    return this.normalizeRows(result.rows).map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }

  async hasMessage(messageId) {
    await this.ensureReady();

    const result = await this.db.executeAsync('SELECT id FROM messages WHERE id = ? LIMIT 1;', [messageId]);
    return this.normalizeRows(result.rows).length > 0;
  }

  async ensureReady() {
    if (!this.db) {
      await this.initialize();
    }
  }

  normalizeRows(rows) {
    if (Array.isArray(rows)) {
      return rows;
    }

    if (Array.isArray(rows?._array)) {
      return rows._array;
    }

    if (typeof rows?.item === 'function' && typeof rows?.length === 'number') {
      return Array.from({length: rows.length}, (_, index) => rows.item(index));
    }

    return [];
  }
}

export default new StorageService();
