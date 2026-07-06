import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSync } from '../state/sync';
import { theme } from '../theme';

/** Compact sync status strip with a manual "sync now" action. */
export function SyncBar() {
  const { syncing, pending, lastSyncedAt, lastResult, syncNow } = useSync();

  let status: string;
  if (syncing) status = 'Syncing…';
  else if (pending > 0) status = `${pending} change${pending === 1 ? '' : 's'} to sync`;
  else if (lastResult && !lastResult.ok && lastResult.reason === 'offline') status = 'Offline';
  else if (lastSyncedAt) status = `Synced ${timeAgo(lastSyncedAt)}`;
  else status = 'Not synced yet';

  return (
    <Pressable onPress={() => void syncNow()} style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: dotColor(syncing, pending, lastResult) }]} />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.action}>{syncing ? '' : 'Sync now'}</Text>
    </Pressable>
  );
}

function dotColor(
  syncing: boolean,
  pending: number,
  lastResult: ReturnType<typeof useSync>['lastResult'],
): string {
  if (syncing) return theme.warn;
  if (pending > 0) return theme.warn;
  if (lastResult && !lastResult.ok) return theme.textFaint;
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
  text: { color: theme.textMuted, fontSize: 13, flex: 1 },
  action: { color: theme.accent, fontSize: 13, fontWeight: '600' },
});
