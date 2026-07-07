import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalQuery } from '../../src/data/hooks';
import { ammoImagesForAmmo, loadAmmo, type Ammo } from '../../src/data/models';
import { addAmmoImage, deleteAmmo, deleteAmmoImage, saveAmmo } from '../../src/data/mutations';
import { capturePhoto, pickPhoto } from '../../src/lib/capture';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { AuthImage } from '../../src/ui/AuthImage';
import { Button, Card, Field, Row, Subtle, TextField, Title } from '../../src/ui/components';
import { Select } from '../../src/ui/Select';

export default function AmmoTab() {
  const { bump } = useSync();
  const ammo = useLocalQuery(loadAmmo);
  const [editing, setEditing] = useState<Ammo | 'new' | null>(null);

  if (editing) {
    return (
      <AmmoForm
        ammo={editing === 'new' ? null : editing}
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
        data={ammo.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        ListHeaderComponent={<Button title="+ New ammo" onPress={() => setEditing('new')} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setEditing(item)}>
            <Card>
              <Row style={{ alignItems: 'center', gap: 12 }}>
                <AmmoThumb ammoId={item.id} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                  <Subtle>
                    {[item.caliber, item.muzzleVelocityMps ? `${item.muzzleVelocityMps} m/s` : null, item.ballisticCoefficient ? `BC ${item.ballisticCoefficient}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Subtle>
                </View>
              </Row>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Card><Subtle>No ammo yet.</Subtle></Card>}
      />
    </View>
  );
}

function AmmoForm({ ammo, onDone }: { ammo: Ammo | null; onDone: () => void }) {
  const [name, setName] = useState(ammo?.name ?? '');
  const [caliber, setCaliber] = useState(ammo?.caliber ?? '');
  const [weight, setWeight] = useState(ammo?.bulletWeightG?.toString() ?? '');
  const [mv, setMv] = useState(ammo?.muzzleVelocityMps?.toString() ?? '');
  const [bc, setBc] = useState(ammo?.ballisticCoefficient?.toString() ?? '');
  const [bcModel, setBcModel] = useState<'G1' | 'G7'>(ammo?.bcModel ?? 'G1');
  const [notes, setNotes] = useState(ammo?.notes ?? '');

  const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

  const save = async () => {
    if (!name.trim()) return;
    await saveAmmo({
      id: ammo?.id,
      name: name.trim(),
      caliber: caliber.trim() || null,
      bulletWeightG: numOrNull(weight),
      muzzleVelocityMps: numOrNull(mv),
      ballisticCoefficient: numOrNull(bc),
      bcModel: bc.trim() ? bcModel : null,
      notes: notes.trim() || null,
    });
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16, gap: 12 }}>
      <Title>{ammo ? 'Edit ammo' : 'New ammo'}</Title>
      {ammo ? (
        <AmmoImagesEditor ammoId={ammo.id} />
      ) : (
        <Subtle>Save the ammo first to add photos.</Subtle>
      )}
      <Field label="Name">
        <TextField value={name} onChangeText={setName} />
      </Field>
      <Field label="Caliber">
        <TextField value={caliber} onChangeText={setCaliber} autoCapitalize="none" />
      </Field>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Bullet weight (g)">
            <TextField value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Muzzle velocity (m/s)">
            <TextField value={mv} onChangeText={setMv} keyboardType="decimal-pad" />
          </Field>
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Ballistic coefficient">
            <TextField value={bc} onChangeText={setBc} keyboardType="decimal-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Drag model">
            <Select
              value={bcModel}
              onChange={(v) => setBcModel(v as 'G1' | 'G7')}
              options={[
                { label: 'G1', value: 'G1' },
                { label: 'G7', value: 'G7' },
              ]}
            />
          </Field>
        </View>
      </Row>
      <Field label="Notes">
        <TextField value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72 }} />
      </Field>
      <Button title="Save" onPress={save} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="ghost" onPress={onDone} />
        </View>
        {ammo && (
          <View style={{ flex: 1 }}>
            <Button
              title="Delete"
              variant="danger"
              onPress={async () => {
                await deleteAmmo(ammo.id);
                onDone();
              }}
            />
          </View>
        )}
      </Row>
    </View>
  );
}

/** First image for an ammo row, as a list thumbnail. */
function AmmoThumb({ ammoId }: { ammoId: string }) {
  const images = useLocalQuery(() => ammoImagesForAmmo(ammoId), [ammoId]);
  const first = images.data?.[0]?.imagePath ?? null;
  return (
    <AuthImage
      path={first}
      style={styles.thumb}
      onError={(m) => console.warn('ammo image', ammoId, m)}
    />
  );
}

/** Add/remove photos on a saved ammo entry. Multiple images per ammo. */
function AmmoImagesEditor({ ammoId }: { ammoId: string }) {
  const { bump, syncNow } = useSync();
  const images = useLocalQuery(() => ammoImagesForAmmo(ammoId), [ammoId]);

  const refresh = () => {
    bump();
    void syncNow();
  };

  const add = async (camera: boolean) => {
    const uri = camera ? await capturePhoto() : await pickPhoto();
    if (!uri) return;
    await addAmmoImage(ammoId, uri);
    refresh();
  };

  const remove = async (id: string) => {
    await deleteAmmoImage(id);
    refresh();
  };

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(images.data ?? []).map((img) => (
          <View key={img.id} style={styles.editorTile}>
            <AuthImage path={img.imagePath} style={styles.editorImage} contentFit="cover" />
            <Pressable style={styles.removeBtn} onPress={() => remove(img.id)}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addTile} onPress={() => add(false)}>
          <Text style={styles.addText}>📷</Text>
        </Pressable>
      </ScrollView>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="📷 Camera" variant="ghost" onPress={() => add(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="🖼 Gallery" variant="ghost" onPress={() => add(false)} />
        </View>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: theme.inputBg },
  editorTile: { position: 'relative' },
  editorImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: theme.inputBg },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontSize: 26 },
});
