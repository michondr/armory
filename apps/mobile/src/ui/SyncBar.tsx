import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../state/sync';
import type { SyncTableCounts } from '../sync/engine';
import { theme } from '../theme';

/**
 * Compact sync status strip with a manual "sync now" action. Shows what's
 * syncing: the current phase while in flight, and a per-table pushed/pulled
 * summary (plus image uploads and any skipped rows) after the last sync.
 */
export function SyncBar() {
  const { syncing, phase, pending, lastSyncedAt, lastResult, syncNow } = useSync();

  const detail = syncing ? null : describeDetail(lastResult, pending);

  let status: string;
  if (syncing) status = phaseLabel(phase);
  else if (lastResult && !lastResult.ok && lastResult.reason === 'offline') status = 'Offline';
  else if (lastResult && !lastResult.ok) status = 'Sync failed';
  else if (pending > 0) status = `${pending} change${pending === 1 ? '' : 's'} to sync`;
  else if (lastSyncedAt) status = `Synced ${timeAgo(lastSyncedAt)}`;
  else status = 'Not synced yet';

  return (
    <Pressable onPress={() => void syncNow()} style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: dotColor(syncing, pending, lastResult) }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.text}>{status}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <Text style={styles.action}>{syncing ? '' : 'Sync now'}</Text>
    </Pressable>
  );
}

function describeDetail(
  lastResult: ReturnType<typeof useSync>['lastResult'],
  pending: number,
): string | null {
  if (!lastResult) return null;
  if (!lastResult.ok) {
    // Show why it failed and how much is still waiting, so a stuck sync isn't
    // silent. (The status line already reads "Offline"/"Sync failed".)
    const parts: string[] = [];
    if (lastResult.message) parts.push(lastResult.message);
    if (pending > 0) parts.push(`${pending} change${pending === 1 ? '' : 's'} pending`);
    return parts.length ? parts.join(' · ') : null;
  }
  const parts: string[] = [];
  const pushed = formatCounts(lastResult.pushed);
  if (pushed) parts.push(`pushed ${pushed}`);
  const pulled = formatCounts(lastResult.pulled);
  if (pulled) parts.push(`pulled ${pulled}`);
  if (lastResult.images) parts.push(`${lastResult.images} image${lastResult.images === 1 ? '' : 's'}`);
  if (lastResult.skipped.length) {
    const reasons = lastResult.skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {});
    const r = Object.entries(reasons)
      .map(([reason, n]) => `${reason}${n > 1 ? ` ×${n}` : ''}`)
      .join(', ');
    parts.push(`skipped: ${r}`);
  }
  if (parts.length === 0) return pending > 0 ? null : 'Up to date';
  return parts.join(' · ');
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

const TABLE_LABEL: Record<string, string> = {
  cartridges: 'cartridges',
  guns: 'guns',
  ammo: 'ammo',
  ammoImages: 'ammo images',
  ammoPriceEntries: 'price entries',
  scopeProfiles: 'scope profiles',
  sessions: 'sessions',
  sets: 'sets',
  targets: 'targets',
  shots: 'shots',
};

function formatCounts(counts: SyncTableCounts): string {
  const entries = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0);
  if (entries.length === 0) return '';
  return entries
    .map(([table, n]) => `${n} ${TABLE_LABEL[table] ?? table}`)
    .join(', ');
}

function dotColor(
  syncing: boolean,
  pending: number,
  lastResult: ReturnType<typeof useSync>['lastResult'],
): string {
  if (syncing) return theme.warn;
  if (lastResult && !lastResult.ok) return theme.danger;
  if (pending > 0) return theme.warn;
  if (lastResult && lastResult.ok && lastResult.skipped.length) return theme.warn;
  return theme.accent;
}

function timeAgo(iso: string): string {
  const secs = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: theme.textMuted, fontSize: 13 },
  detail: { color: theme.textFaint, fontSize: 11 },
  action: { color: theme.accent, fontSize: 13, fontWeight: '600' },
});