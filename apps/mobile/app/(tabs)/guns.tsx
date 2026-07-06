import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalQuery } from '../../src/data/hooks';
import { loadGuns, type Gun } from '../../src/data/models';
import { deleteGun, saveGun } from '../../src/data/mutations';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Field, Row, Subtle, TextField, Title } from '../../src/ui/components';

export default function GunsTab() {
  const { bump } = useSync();
  const guns = useLocalQuery(loadGuns);
  const [editing, setEditing] = useState<Gun | 'new' | null>(null);

  if (editing) {
    return (
      <GunForm
        gun={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          bump();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={guns.data ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        ListHeaderComponent={<Button title="+ New gun" onPress={() => setEditing('new')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setEditing(item)}>
            <Card>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
              {item.caliber ? <Subtle>{item.caliber}</Subtle> : null}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Card><Subtle>No guns yet.</Subtle></Card>}
      />
    </View>
  );
}

function GunForm({ gun, onDone }: { gun: Gun | null; onDone: () => void }) {
  const [name, setName] = useState(gun?.name ?? '');
  const [caliber, setCaliber] = useState(gun?.caliber ?? '');
  const [initial, setInitial] = useState(String(gun?.initialRoundCount ?? 0));
  const [notes, setNotes] = useState(gun?.notes ?? '');

  const save = async () => {
    if (!name.trim()) return;
    await saveGun({
      id: gun?.id,
      name: name.trim(),
      caliber: caliber.trim() || null,
      notes: notes.trim() || null,
      initialRoundCount: Number(initial) || 0,
      cleaningIntervalRounds: gun?.cleaningIntervalRounds ?? null,
      lastCleanedAtRound: gun?.lastCleanedAtRound ?? 0,
      imagePath: gun?.imagePath ?? null,
    });
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16, gap: 12 }}>
      <Title>{gun ? 'Edit gun' : 'New gun'}</Title>
      <Field label="Name">
        <TextField value={name} onChangeText={setName} />
      </Field>
      <Field label="Caliber">
        <TextField value={caliber} onChangeText={setCaliber} autoCapitalize="none" />
      </Field>
      <Field label="Initial round count">
        <TextField value={initial} onChangeText={setInitial} keyboardType="number-pad" />
      </Field>
      <Field label="Notes">
        <TextField value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72 }} />
      </Field>
      <Button title="Save" onPress={save} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="ghost" onPress={onDone} />
        </View>
        {gun && (
          <View style={{ flex: 1 }}>
            <Button
              title="Delete"
              variant="danger"
              onPress={async () => {
                await deleteGun(gun.id);
                onDone();
              }}
            />
          </View>
        )}
      </Row>
    </View>
  );
}
