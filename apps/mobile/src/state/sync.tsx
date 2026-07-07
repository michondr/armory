import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getSyncState, setSyncState } from '../db/client';
import { countDirty, newId } from '../db/repo';
import { runSync, type SyncPhase, type SyncResult } from '../sync/engine';
import { useAuth } from './auth';

interface SyncContextValue {
  /** Bumps on every data change (local write or sync) so screens can re-query. */
  dataVersion: number;
  /** Call after any local write to refresh dependent screens. */
  bump: () => void;
  syncing: boolean;
  /** Current step within an in-flight sync (null when idle). */
  phase: SyncPhase | null;
  pending: number;
  lastSyncedAt: string | null;
  lastResult: SyncResult | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

async function getDeviceId(): Promise<string> {
  const existing = await getSyncState('deviceId');
  if (existing) return existing;
  const id = newId();
  await setSyncState('deviceId', id);
  return id;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dataVersion, setDataVersion] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [phase, setPhase] = useState<SyncPhase | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const syncingRef = useRef(false);

  const bump = useCallback(() => {
    setDataVersion((v) => v + 1);
    countDirty().then(setPending).catch(() => {});
  }, []);

  const syncNow = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const deviceId = await getDeviceId();
      const result = await runSync(deviceId, `${Platform.OS} device`, setPhase);
      setLastResult(result);
      if (result.ok) {
        setLastSyncedAt(new Date().toISOString());
        setDataVersion((v) => v + 1);
      }
      await countDirty().then(setPending).catch(() => {});
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setPhase(null);
    }
  }, [user]);

  // Initial pending count + sync when a user is present.
  useEffect(() => {
    if (!user) return;
    countDirty().then(setPending).catch(() => {});
    void syncNow();
  }, [user, syncNow]);

  // Sync when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  // Sync when connectivity is regained.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncNow();
    });
    return unsub;
  }, [syncNow]);

  const value = useMemo(
    () => ({ dataVersion, bump, syncing, phase, pending, lastSyncedAt, lastResult, syncNow }),
    [dataVersion, bump, syncing, phase, pending, lastSyncedAt, lastResult, syncNow],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
