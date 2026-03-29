import {useCallback, useEffect, useState} from 'react';
import NetInfo from '@react-native-community/netinfo';

import {
  countUnsyncedEmergencyLogs,
  getUnsyncedEmergencyLogs,
  markEmergencyLogsFailed,
  markEmergencyLogsSynced,
} from '../database/Schema';

const DEFAULT_SYNC_ENDPOINT = 'http://10.0.2.2:4000/api/sync';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface UseSyncState extends SyncState {
  syncNow: () => Promise<void>;
}

export const useSync = (endpoint = DEFAULT_SYNC_ENDPOINT): UseSyncState => {
  const [state, setState] = useState<SyncState>({
    isOnline: false,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  });

  const refreshPendingCount = useCallback(async () => {
    const pendingCount = await countUnsyncedEmergencyLogs();
    setState(current => ({...current, pendingCount}));
  }, []);

  const syncNow = useCallback(async () => {
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

    void NetInfo.fetch().then(handleNetworkChange);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [refreshPendingCount, syncNow]);

  return {
    ...state,
    syncNow,
  };
};

export default useSync;
