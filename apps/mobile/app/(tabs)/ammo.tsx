import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalQuery } from '../../src/data/hooks';
import { loadAmmo, type Ammo } from '../../src/data/models';
import { deleteAmmo, saveAmmo } from '../../src/data/mutations';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
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
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
              <Subtle>
                {[item.caliber, item.muzzleVelocityMps ? `${item.muzzleVelocityMps} m/s` : null, item.ballisticCoefficient ? `BC ${item.ballisticCoefficient}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Subtle>
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
