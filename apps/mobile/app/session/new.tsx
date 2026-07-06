import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useLocalQuery } from '../../src/data/hooks';
import { ammoForCaliber, loadGuns } from '../../src/data/models';
import { saveSession } from '../../src/data/mutations';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Field, Row, Screen, Subtle, TextField, Title } from '../../src/ui/components';
import { Select } from '../../src/ui/Select';

export default function NewSession() {
  const router = useRouter();
  const { bump, syncNow } = useSync();
  const guns = useLocalQuery(loadGuns);

  const [gunId, setGunId] = useState('');
  const gun = (guns.data ?? []).find((g) => g.id === gunId);
  const ammo = useLocalQuery(() => ammoForCaliber(gun?.caliber ?? null), [gun?.caliber ?? '']);

  const [ammoId, setAmmoId] = useState('');
  const [discipline, setDiscipline] = useState<'SHORT' | 'LONG'>('SHORT');
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const grabLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      /* GPS unavailable — fine, location is optional */
    } finally {
      setLocating(false);
    }
  };

  const create = async () => {
    if (!gunId) return;
    setBusy(true);
    const id = await saveSession({
      gunId,
      ammoId: ammoId || null,
      startedAt: new Date().toISOString(),
      locationName: locationName.trim() || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      discipline,
      notes: notes.trim() || null,
    });
    bump();
    void syncNow();
    router.replace(`/session/${id}`);
  };

  return (
    <Screen>
      <Title>New session</Title>
      <Subtle>Everything here is saved offline immediately and synced when you have a connection.</Subtle>

      <Card>
        <Field label="Gun">
          <Select
            value={gunId}
            placeholder="Select gun"
            onChange={(v) => {
              setGunId(v);
              setAmmoId('');
            }}
            options={(guns.data ?? []).map((g) => ({ label: g.name, value: g.id }))}
          />
        </Field>
        <Field label="Ammo (optional)">
          <Select
            value={ammoId}
            placeholder={gun?.caliber ? `${gun.caliber} ammo` : 'Select ammo'}
            onChange={setAmmoId}
            options={(ammo.data ?? []).map((a) => ({ label: a.name, value: a.id }))}
          />
        </Field>
        <Field label="Discipline">
          <Select
            value={discipline}
            onChange={(v) => setDiscipline(v as 'SHORT' | 'LONG')}
            options={[
              { label: 'Short range', value: 'SHORT' },
              { label: 'Long range', value: 'LONG' },
            ]}
          />
        </Field>
      </Card>

      <Card>
        <Field label="Location name">
          <TextField value={locationName} onChangeText={setLocationName} placeholder="e.g. Local range" />
        </Field>
        <Row style={{ justifyContent: 'space-between' }}>
          <Button title={locating ? 'Locating…' : '📍 Use GPS'} variant="ghost" onPress={grabLocation} loading={locating} />
          {coords && (
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
          )}
        </Row>
        <Field label="Notes">
          <TextField value={notes} onChangeText={setNotes} multiline style={{ minHeight: 64 }} />
        </Field>
      </Card>

      <Button title="Start session" onPress={create} loading={busy} disabled={!gunId} />
    </Screen>
  );
}
