import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalQuery } from '../../src/data/hooks';
import { loadGuns, type Gun } from '../../src/data/models';
import { deleteGun, saveGun } from '../../src/data/mutations';
import { capturePhoto, pickPhoto } from '../../src/lib/capture';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { AuthImage } from '../../src/ui/AuthImage';
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
              <Row style={{ alignItems: 'center', gap: 12 }}>
                <AuthImage
                  path={item.imagePath}
                  style={styles.thumb}
                  onError={(m) => console.warn('gun image', item.id, m)}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                  {item.caliber ? <Subtle>{item.caliber}</Subtle> : null}
                </View>
              </Row>
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
  const [imagePath, setImagePath] = useState<string | null>(gun?.imagePath ?? null);

  const addPhoto = async (camera: boolean) => {
    const uri = camera ? await capturePhoto() : await pickPhoto();
    if (uri) setImagePath(uri);
  };

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
      imagePath,
    });
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16, gap: 12 }}>
      <Title>{gun ? 'Edit gun' : 'New gun'}</Title>
      <Row style={{ alignItems: 'center', gap: 12 }}>
        {imagePath ? (
          <AuthImage path={imagePath} style={styles.preview} onError={(m) => console.warn('gun image', m)} />
        ) : (
          <View style={styles.preview} />
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Button title="📷 Camera" variant="ghost" onPress={() => addPhoto(true)} />
          <Button title="🖼 Gallery" variant="ghost" onPress={() => addPhoto(false)} />
          {imagePath && <Button title="Remove photo" variant="ghost" onPress={() => setImagePath(null)} />}
        </View>
      </Row>
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

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: theme.inputBg },
  preview: { width: 96, height: 96, borderRadius: 12, backgroundColor: theme.inputBg },
});
