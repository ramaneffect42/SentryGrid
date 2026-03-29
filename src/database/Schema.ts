import {open} from 'react-native-quick-sqlite';

export type EmergencyEventType = 'SOS' | 'TEXT' | 'RELAY';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
}

export interface EmergencyLogRecord {
  id: string;
  senderId: string;
  eventType: EmergencyEventType;
  message: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  hopCount: number;
  maxHops: number;
  transport: string;
  route: string[];
  syncStatus: SyncStatus;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface MeshPeerRecord {
  id: string;
  name: string | null;
  transport: string;
  deviceType: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

type SQLiteDatabase = ReturnType<typeof open>;

let db: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

const normalizeRows = (rows: unknown): any[] => {
  if (Array.isArray(rows)) {
    return rows;
  }

  if (Array.isArray((rows as any)?._array)) {
    return (rows as any)._array;
  }

  if (typeof (rows as any)?.item === 'function' && typeof (rows as any)?.length === 'number') {
    return Array.from({length: (rows as any).length}, (_, index) => (rows as any).item(index));
  }

  return [];
};

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
};

const mapEmergencyRow = (row: any): EmergencyLogRecord => ({
  id: row.id,
  senderId: row.senderId,
  eventType: row.eventType,
  message: row.message,
  latitude: row.latitude ?? null,
  longitude: row.longitude ?? null,
  accuracy: row.accuracy ?? null,
  altitude: row.altitude ?? null,
  hopCount: row.hopCount,
  maxHops: row.maxHops,
  transport: row.transport,
  route: parseJson<string[]>(row.route, []),
  syncStatus: row.syncStatus,
  syncedAt: row.syncedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
});

const mapPeerRow = (row: any): MeshPeerRecord => ({
  id: row.id,
  name: row.name ?? null,
  transport: row.transport,
  deviceType: row.deviceType,
  lastSeen: row.lastSeen,
  metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
});

export const initializeDatabase = async (): Promise<SQLiteDatabase> => {
  if (db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const instance = open({name: 'sentrygrid.db'});

    await instance.executeBatchAsync([
      [
        `CREATE TABLE IF NOT EXISTS emergency_logs (
          id TEXT PRIMARY KEY NOT NULL,
          senderId TEXT NOT NULL,
          eventType TEXT NOT NULL,
          message TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          altitude REAL,
          hopCount INTEGER NOT NULL DEFAULT 0,
          maxHops INTEGER NOT NULL DEFAULT 5,
          transport TEXT NOT NULL,
          route TEXT NOT NULL,
          syncStatus TEXT NOT NULL DEFAULT 'pending',
          syncedAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}'
        );`,
      ],
      [
        `CREATE TABLE IF NOT EXISTS mesh_peers (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          transport TEXT NOT NULL,
          deviceType TEXT NOT NULL,
          lastSeen TEXT NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}'
        );`,
      ],
      [
        `CREATE INDEX IF NOT EXISTS idx_emergency_logs_sync_status
         ON emergency_logs(syncStatus, createdAt DESC);`,
      ],
    ]);

    db = instance;
    return instance;
  })();

  return initPromise;
};

export const getDatabase = async (): Promise<SQLiteDatabase> => initializeDatabase();

export const saveEmergencyLog = async (log: EmergencyLogRecord): Promise<void> => {
  const database = await getDatabase();

  await database.executeAsync(
    `INSERT OR REPLACE INTO emergency_logs
      (id, senderId, eventType, message, latitude, longitude, accuracy, altitude, hopCount, maxHops,
       transport, route, syncStatus, syncedAt, createdAt, updatedAt, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      log.id,
      log.senderId,
      log.eventType,
      log.message,
      log.latitude,
      log.longitude,
      log.accuracy,
      log.altitude,
      log.hopCount,
      log.maxHops,
      log.transport,
      JSON.stringify(log.route),
      log.syncStatus,
      log.syncedAt,
      log.createdAt,
      log.updatedAt,
      JSON.stringify(log.metadata),
    ],
  );
};

export const hasEmergencyLog = async (id: string): Promise<boolean> => {
  const database = await getDatabase();
  const result = await database.executeAsync(
    'SELECT id FROM emergency_logs WHERE id = ? LIMIT 1;',
    [id],
  );

  return normalizeRows(result.rows).length > 0;
};

export const getRecentEmergencyLogs = async (limit = 50): Promise<EmergencyLogRecord[]> => {
  const database = await getDatabase();
  const result = await database.executeAsync(
    `SELECT *
     FROM emergency_logs
     ORDER BY createdAt DESC
     LIMIT ?;`,
    [limit],
  );

  return normalizeRows(result.rows).map(mapEmergencyRow);
};

export const getUnsyncedEmergencyLogs = async (limit = 100): Promise<EmergencyLogRecord[]> => {
  const database = await getDatabase();
  const result = await database.executeAsync(
    `SELECT *
     FROM emergency_logs
     WHERE syncStatus != 'synced'
     ORDER BY createdAt ASC
     LIMIT ?;`,
    [limit],
  );

  return normalizeRows(result.rows).map(mapEmergencyRow);
};

export const markEmergencyLogsSynced = async (ids: string[], syncedAt = new Date().toISOString()): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  const database = await getDatabase();

  await Promise.all(
    ids.map(id =>
      database.executeAsync(
        `UPDATE emergency_logs
         SET syncStatus = 'synced', syncedAt = ?, updatedAt = ?
         WHERE id = ?;`,
        [syncedAt, syncedAt, id],
      ),
    ),
  );
};

export const markEmergencyLogsFailed = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  const database = await getDatabase();
  const updatedAt = new Date().toISOString();

  await Promise.all(
    ids.map(id =>
      database.executeAsync(
        `UPDATE emergency_logs
         SET syncStatus = 'failed', updatedAt = ?
         WHERE id = ?;`,
        [updatedAt, id],
      ),
    ),
  );
};

export const countUnsyncedEmergencyLogs = async (): Promise<number> => {
  const database = await getDatabase();
  const result = await database.executeAsync(
    `SELECT COUNT(*) AS total
     FROM emergency_logs
     WHERE syncStatus != 'synced';`,
  );

  const [row] = normalizeRows(result.rows);
  return Number(row?.total ?? 0);
};

export const upsertMeshPeer = async (peer: MeshPeerRecord): Promise<void> => {
  const database = await getDatabase();

  await database.executeAsync(
    `INSERT INTO mesh_peers (id, name, transport, deviceType, lastSeen, metadata)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       transport = excluded.transport,
       deviceType = excluded.deviceType,
       lastSeen = excluded.lastSeen,
       metadata = excluded.metadata;`,
    [
      peer.id,
      peer.name,
      peer.transport,
      peer.deviceType,
      peer.lastSeen,
      JSON.stringify(peer.metadata),
    ],
  );
};

export const getMeshPeers = async (): Promise<MeshPeerRecord[]> => {
  const database = await getDatabase();
  const result = await database.executeAsync(
    `SELECT *
     FROM mesh_peers
     ORDER BY lastSeen DESC;`,
  );

  return normalizeRows(result.rows).map(mapPeerRow);
};
