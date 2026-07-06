import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocalQuery } from '../../src/data/hooks';
import {
  fmtStat,
  loadGuns,
  loadSessions,
  loadSessionStats,
  type Gun,
  type SessionRow,
} from '../../src/data/models';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Pill, Row, Subtle } from '../../src/ui/components';
import { SyncBar } from '../../src/ui/SyncBar';

export default function SessionsTab() {
  const router = useRouter();
  const { syncing, syncNow } = useSync();
  const sessions = useLocalQuery(loadSessions);
  const guns = useLocalQuery(loadGuns);

  const gunById = new Map((guns.data ?? []).map((g) => [g.id, g]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={sessions.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} tintColor={theme.accent} />
        }
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <SyncBar />
            <Button title="+ New session" onPress={() => router.push('/session/new')} />
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            gun={gunById.get(item.gunId) ?? null}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Card>
            <Subtle>No sessions yet. Tap “New session” to log your first range trip — it works fully offline.</Subtle>
          </Card>
        }
      />
    </View>
  );
}

function SessionCard({
  session,
  gun,
  onPress,
}: {
  session: SessionRow;
  gun: Gun | null;
  onPress: () => void;
}) {
  const stats = useLocalQuery(() => loadSessionStats(session.id), [session.id]);
  const when = new Date(session.startedAt).toLocaleDateString();

  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
            {gun?.name ?? 'Session'}
          </Text>
          <Pill tone={session.discipline === 'LONG' ? 'accent' : 'muted'}>{session.discipline}</Pill>
        </Row>
        <Subtle>
          {when}
          {session.locationName ? ` · ${session.locationName}` : ''}
        </Subtle>
        {stats.data && stats.data.count > 0 && (
          <Row style={{ gap: 16 }}>
            <Stat label="Avg" value={fmtStat(stats.data.average)} />
            <Stat label="Best 90%" value={fmtStat(stats.data.best90)} />
            <Stat label="Worst 10%" value={fmtStat(stats.data.worst10)} />
            <Stat label="Shots" value={String(stats.data.count)} />
          </Row>
        )}
      </Card>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: theme.textFaint, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
