import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { SyncTable } from '@armory/shared';
import { dirtyCounts } from '../db/repo';
import { API_URL } from '../lib/config';
import { testConnection, type ConnectionTestResult } from '../lib/api';
import { useSync } from '../state/sync';
import { countPendingImages } from '../sync/images';
import type { SyncLogEntry } from '../sync/engine';
import { theme } from '../theme';
import { Button, Card, Row, Subtle } from './components';

/**
 * Sync diagnostics panel for the Settings screen: shows live status, per-table
 * dirty counts, the pending image queue, rows the server skipped, and a
 * timestamped log of what each sync actually did. This is the place to look when
 * the SyncBar is stuck on "x changes to sync" — the log says which phase ran
 * and why rows did or didn't clear.
 */
export function SyncDiagnostics() {
  const { syncing, phase, lastResult, lastSyncedAt, logs, clearLogs, syncNow, dataVersion } = useSync();
  const [dirty, setDirty] = useState<Partial<Record<SyncTable, number>>>({});
  const [pendingImages, setPendingImages] = useState(0);
  const [net, setNet] = useState<{ connected: boolean | null; type: string | null }>({
    connected: null,
    type: null,
  });
  const [conn, setConn] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Re-fetch counts whenever data changes or a sync finishes/advances.
  useEffect(() => {
    void dirtyCounts().then(setDirty);
    void countPendingImages().then(setPendingImages);
  }, [dataVersion, syncing, lastResult, logs.length]);

  // Live network state — explains "says offline but I'm on wifi": isConnected is
  // the device's local view (wifi up), isInternetReachable is whether it can get
  // out. The connection test below is the authoritative check against the API.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setNet({ connected: s.isConnected ?? null, type: s.type ?? null });
    });
    return unsub;
  }, []);

  const runTest = async () => {
    setTesting(true);
    try {
      setConn(await testConnection());
    } finally {
      setTesting(false);
    }
  };

  const status = syncing
    ? phaseLabel(phase)
    : lastResult && !lastResult.ok
      ? lastResult.reason === 'offline'
        ? 'Offline'
        : 'Failed'
      : lastResult?.ok
        ? 'Idle'
        : 'Not synced yet';

  const dirtyEntries = Object.entries(dirty).filter(([, n]) => (n ?? 0) > 0);
  const skipped = lastResult?.ok ? lastResult.skipped : [];

  return (
    <Card>
      <Text style={{ color: theme.text, fontWeight: '600' }}>Sync diagnostics</Text>

      <Row style={{ justifyContent: 'space-between' }}>
        <Subtle>Status</Subtle>
        <Text style={{ color: theme.text }}>{status}</Text>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Subtle>Last sync</Subtle>
        <Text style={{ color: theme.textFaint, fontSize: 12 }}>
          {lastSyncedAt ? timeAgo(lastSyncedAt) : 'never'}
        </Text>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Subtle>Pending images</Subtle>
        <Text style={{ color: theme.text }}>{pendingImages}</Text>
      </Row>

      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Subtle>Network</Subtle>
          <Text style={{ color: theme.textFaint, fontSize: 12 }}>
            {net.connected === null ? '—' : net.connected ? `${net.type ?? 'online'}` : 'no connection'}
          </Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Subtle>API</Subtle>
          <Text style={{ color: theme.textFaint, fontSize: 11 }}>{API_URL}</Text>
        </Row>
        {conn && (
          <Text style={[styles.muted, { color: conn.ok ? theme.accent : theme.danger }]}>
            {conn.ok ? `✓ ${conn.message} (${conn.ms}ms)` : `✗ ${conn.message}`}
          </Text>
        )}
        <Button title={testing ? 'Testing…' : 'Test connection'} variant="ghost" onPress={() => void runTest()} disabled={testing} />
      </View>

      <View style={{ gap: 4 }}>
        <Subtle>Pending by table</Subtle>
        {dirtyEntries.length === 0 ? (
          <Text style={styles.muted}>None — everything is pushed.</Text>
        ) : (
          dirtyEntries.map(([table, n]) => (
            <Row key={table} style={{ justifyContent: 'space-between' }}>
              <Text style={styles.muted}>{table}</Text>
              <Text style={{ color: theme.warn, fontVariant: ['tabular-nums'] }}>{n}</Text>
            </Row>
          ))
        )}
      </View>

      {skipped.length > 0 && (
        <View style={{ gap: 4 }}>
          <Subtle>Skipped by server (left to retry)</Subtle>
          {skipped.map((s) => (
            <Text key={`${s.table}-${s.id}`} style={styles.warn}>
              {s.table}/{s.id.slice(0, 8)}: {s.reason}
            </Text>
          ))}
        </View>
      )}

      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={syncing ? 'Syncing…' : 'Sync now'} onPress={() => void syncNow()} disabled={syncing} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Clear log" variant="ghost" onPress={clearLogs} />
        </View>
      </Row>

      <View style={{ gap: 4 }}>
        <Subtle>Sync log</Subtle>
        {logs.length === 0 ? (
          <Text style={styles.muted}>No syncs yet.</Text>
        ) : (
          <ScrollView style={styles.log} bounces={false}>
            {logs.map((entry, i) => (
              <LogLine key={`${entry.ts}-${i}`} entry={entry} />
            ))}
          </ScrollView>
        )}
      </View>
    </Card>
  );
}

function LogLine({ entry }: { entry: SyncLogEntry }) {
  const color = entry.level === 'error' ? theme.danger : entry.level === 'warn' ? theme.warn : theme.textMuted;
  return (
    <Text style={[styles.logLine, { color }]}>
      <Text style={{ color: theme.textFaint }}>{entry.ts.slice(11, 19)}</Text> {entry.message}
    </Text>
  );
}

function phaseLabel(phase: ReturnType<typeof useSync>['phase']): string {
  switch (phase) {
    case 'images':
      return 'Uploading images…';
    case 'push':
      return 'Pushing changes…';
    case 'pull':
      return 'Pulling changes…';
    default:
      return 'Syncing…';
  }
}

function timeAgo(iso: string): string {
  const secs = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const styles = StyleSheet.create({
  muted: { color: theme.textFaint, fontSize: 12 },
  warn: { color: theme.warn, fontSize: 12 },
  log: { maxHeight: 260 },
  logLine: { fontSize: 12, fontFamily: 'monospace', lineHeight: 16 },
});