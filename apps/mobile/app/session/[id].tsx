import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLocalQuery } from '../../src/data/hooks';
import { fmtStat, loadSessionTree, type SessionTree } from '../../src/data/models';
import {
  addSet,
  addTarget,
  attachTargetImage,
  deleteSet,
  deleteTarget,
  setTargetShots,
} from '../../src/data/mutations';
import { capturePhoto, pickPhoto } from '../../src/lib/capture';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Field, Pill, Row, Screen, Subtle, TextField, Title } from '../../src/ui/components';
import { Select } from '../../src/ui/Select';
import { TargetScorer, type PlacedShot } from '../../src/ui/TargetScorer';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bump, syncNow } = useSync();
  const tree = useLocalQuery(() => loadSessionTree(id), [id]);
  const [newDistance, setNewDistance] = useState('');

  const refresh = () => {
    bump();
    void syncNow();
  };

  if (!tree.data) {
    return (
      <Screen>
        <Subtle>Loading…</Subtle>
      </Screen>
    );
  }
  const t: SessionTree = tree.data;

  const onAddSet = async () => {
    await addSet(id, newDistance ? Number(newDistance) : null, t.sets.length);
    setNewDistance('');
    refresh();
  };

  return (
    <Screen>
      <Title>{t.gun?.name ?? 'Session'}</Title>
      <Subtle>
        {new Date(t.session.startedAt).toLocaleString()}
        {t.session.locationName ? ` · ${t.session.locationName}` : ''}
      </Subtle>
      {t.stats.count > 0 && (
        <Row style={{ gap: 16 }}>
          <Stat label="Avg" value={fmtStat(t.stats.average)} />
          <Stat label="Best 90%" value={fmtStat(t.stats.best90)} />
          <Stat label="Worst 10%" value={fmtStat(t.stats.worst10)} />
          <Stat label="Shots" value={String(t.stats.count)} />
        </Row>
      )}

      {t.sets.map((s) => (
        <SetCard key={s.set.id} set={s} onChanged={refresh} />
      ))}

      <Card>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Add set</Text>
        <Field label="Distance (m, optional)">
          <TextField value={newDistance} onChangeText={setNewDistance} keyboardType="number-pad" />
        </Field>
        <Button title="+ Add set" onPress={onAddSet} />
      </Card>
    </Screen>
  );
}

function SetCard({
  set,
  onChanged,
}: {
  set: SessionTree['sets'][number];
  onChanged: () => void;
}) {
  const addNewTarget = async (scoring: 'RINGS' | 'IPSC') => {
    await addTarget(set.set.id, scoring, scoring === 'RINGS' ? 10 : null);
    onChanged();
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: theme.text, fontWeight: '700' }}>
          {set.set.distanceM ? `${set.set.distanceM} m` : 'Set'}
        </Text>
        <Pill>{set.targets.length} target{set.targets.length === 1 ? '' : 's'}</Pill>
      </Row>

      {set.targets.map((tg) => (
        <TargetBlock key={tg.target.id} target={tg} onChanged={onChanged} />
      ))}

      <Row>
        <View style={{ flex: 1 }}>
          <Button title="+ Rings target" variant="ghost" onPress={() => addNewTarget('RINGS')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="+ IPSC target" variant="ghost" onPress={() => addNewTarget('IPSC')} />
        </View>
      </Row>
      <Button
        title="Delete set"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete set?', 'This removes the set and its targets.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteSet(set.set.id);
                onChanged();
              },
            },
          ])
        }
      />
    </Card>
  );
}

function TargetBlock({
  target,
  onChanged,
}: {
  target: SessionTree['sets'][number]['targets'][number];
  onChanged: () => void;
}) {
  const [scoring, setScoring] = useState(false);
  const [textValues, setTextValues] = useState('');
  const tg = target.target;

  const initialShots: PlacedShot[] = target.shots
    .filter((s) => s.x != null && s.y != null)
    .map((s) => ({ x: s.x!, y: s.y!, ringValue: s.ringValue, zone: s.zone }));

  const addPhoto = async (fromCamera: boolean) => {
    const uri = fromCamera ? await capturePhoto() : await pickPhoto();
    if (!uri) return;
    await attachTargetImage(tg.id, uri);
    onChanged();
    setScoring(true);
  };

  const saveText = async () => {
    const values = textValues
      .split(/[\s,]+/)
      .map((v) => Number(v))
      .filter((v) => !Number.isNaN(v));
    await setTargetShots(
      tg.id,
      values.map((v) => ({ x: null, y: null, ringValue: v, zone: null })),
    );
    setTextValues('');
    setScoring(false);
    onChanged();
  };

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: theme.cardBorder, paddingTop: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: theme.text }}>
          {tg.scoringSystem} · {tg.shotCount} shots
          {tg.totalScore != null ? ` · ${tg.totalScore} pts` : ''}
        </Text>
        <Pill tone={tg.status === 'MANUAL' ? 'accent' : 'muted'}>{tg.status}</Pill>
      </Row>

      {tg.imagePath && scoring ? (
        <TargetScorer
          imagePath={tg.imagePath}
          scoringSystem={tg.scoringSystem}
          maxScorePerShot={tg.maxScorePerShot}
          initialShots={initialShots}
          onSave={async (shots) => {
            await setTargetShots(tg.id, shots);
            setScoring(false);
            onChanged();
          }}
        />
      ) : (
        <>
          {!tg.imagePath && (
            <Field label="Quick scores (e.g. 10 9 9 8)">
              <TextField
                value={textValues}
                onChangeText={setTextValues}
                keyboardType="numbers-and-punctuation"
                placeholder="space or comma separated"
              />
            </Field>
          )}
          <Row style={{ flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title="📷 Camera" variant="ghost" onPress={() => addPhoto(true)} />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title="🖼 Gallery" variant="ghost" onPress={() => addPhoto(false)} />
            </View>
            {tg.imagePath && (
              <View style={{ flex: 1, minWidth: 120 }}>
                <Button title="Score photo" onPress={() => setScoring(true)} />
              </View>
            )}
            {!tg.imagePath && textValues.trim() !== '' && (
              <View style={{ flex: 1, minWidth: 120 }}>
                <Button title="Save scores" onPress={saveText} />
              </View>
            )}
          </Row>
          <Button
            title="Delete target"
            variant="danger"
            onPress={async () => {
              await deleteTarget(tg.id);
              onChanged();
            }}
          />
        </>
      )}
    </View>
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
