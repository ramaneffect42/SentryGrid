import {useCallback, useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

import {
  countUnsyncedEmergencyLogs,
  getAppSetting,
  getUnsyncedEmergencyLogs,
  markEmergencyLogsFailed,
  markEmergencyLogsSynced,
  setAppSetting,
} from '../database/Schema';
import {DEFAULT_SYNC_SERVER_BASE_URL, toHealthEndpoint, toSyncEndpoint} from '../config/runtime';

const SYNC_SERVER_URL_KEY = 'syncServerBaseUrl';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
  serverBaseUrl: string;
  healthStatus: string | null;
}

export interface UseSyncState extends SyncState {
  syncNow: () => Promise<void>;
  setServerBaseUrl: (value: string) => Promise<void>;
  checkServerHealth: () => Promise<void>;
}

export const useSync = (): UseSyncState => {
  const [state, setState] = useState<SyncState>({
    isOnline: false,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
    serverBaseUrl: DEFAULT_SYNC_SERVER_BASE_URL,
    healthStatus: null,
  });

  const endpoint = toSyncEndpoint(state.serverBaseUrl);

  const refreshPendingCount = useCallback(async () => {
    const pendingCount = await countUnsyncedEmergencyLogs();
    setState(current => ({...current, pendingCount}));
  }, []);

  const loadServerBaseUrl = useCallback(async () => {
    const savedValue = await getAppSetting(SYNC_SERVER_URL_KEY);

    if (savedValue !== null) {
      setState(current => ({...current, serverBaseUrl: savedValue}));
    }
  }, []);

  const setServerBaseUrl = useCallback(async (value: string) => {
    const normalized = value.trim().replace(/\/+$/, '');
    await setAppSetting(SYNC_SERVER_URL_KEY, normalized);
    setState(current => ({
      ...current,
      serverBaseUrl: normalized,
      healthStatus: null,
      error: null,
    }));
  }, []);

  const checkServerHealth = useCallback(async () => {
    const healthEndpoint = toHealthEndpoint(state.serverBaseUrl);

    if (!healthEndpoint) {
      setState(current => ({
        ...current,
        healthStatus: 'Set the server URL first.',
        error: 'Set the sync server URL before checking health.',
      }));
      return;
    }

    try {
      const response = await fetch(healthEndpoint);

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const payload = await response.json();
      setState(current => ({
        ...current,
        healthStatus: `Server ${payload?.status ?? 'ok'} | Mongo ready state ${payload?.mongoReadyState ?? 'unknown'}`,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the sync server';
      setState(current => ({
        ...current,
        healthStatus: `Health check failed: ${message}`,
        error: message,
      }));
    }
  }, [state.serverBaseUrl]);

  const syncNow = useCallback(async () => {
    if (!endpoint) {
      setState(current => ({
        ...current,
        isSyncing: false,
        error: 'Set the sync server URL first.',
      }));
      return;
    }

    setState(current => ({...current, isSyncing: true, error: null}));

    const pendingLogs = await getUnsyncedEmergencyLogs();

    if (pendingLogs.length === 0) {
      setState(current => ({...current, isSyncing: false, pendingCount: 0}));
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({logs: pendingLogs}),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status ${response.status}`);
      }

      const payload = await response.json();
      const syncedIds: string[] = Array.isArray(payload?.syncedIds)
        ? payload.syncedIds
        : pendingLogs.map(log => log.id);
      const syncedAt = payload?.syncedAt ?? new Date().toISOString();

      await markEmergencyLogsSynced(syncedIds, syncedAt);
      const pendingCount = await countUnsyncedEmergencyLogs();
      setState(current => ({
        ...current,
        isSyncing: false,
        pendingCount,
        lastSyncedAt: syncedAt,
        error: null,
        healthStatus: 'Sync API reachable',
      }));
    } catch (error) {
      await markEmergencyLogsFailed(pendingLogs.map(log => log.id));
      const message = error instanceof Error ? error.message : 'Unable to sync emergency logs';
      const pendingCount = await countUnsyncedEmergencyLogs();
      setState(current => ({
        ...current,
        isSyncing: false,
        pendingCount,
        error: message,
        healthStatus: `Sync failed: ${message}`,
      }));
    }
  }, [endpoint]);

  useEffect(() => {
    let isMounted = true;

    const handleNetworkChange = async (netState: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => {
      const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);

      if (!isMounted) {
        return;
      }

      setState(current => ({...current, isOnline}));
      await refreshPendingCount();

      if (isOnline) {
        await syncNow();
      }
    };

    const unsubscribe = NetInfo.addEventListener(netState => {
      void handleNetworkChange(netState);
    });

    void loadServerBaseUrl();
    void NetInfo.fetch().then(handleNetworkChange);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadServerBaseUrl, refreshPendingCount, syncNow]);

  return {
    ...state,
    syncNow,
    setServerBaseUrl,
    checkServerHealth,
  };
};

export default useSync;
