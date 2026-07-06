import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { solveFiringSolution, type DragModel } from '@armory/ballistics';
import { useLocalQuery } from '../../src/data/hooks';
import {
  loadAmmo,
  loadGuns,
  loadScopeProfiles,
  type Ammo,
  type Gun,
  type ScopeProfile,
} from '../../src/data/models';
import { deleteScopeProfile, saveScopeProfile } from '../../src/data/mutations';
import { useSync } from '../../src/state/sync';
import { theme } from '../../src/theme';
import { Button, Card, Field, Row, Subtle, TextField, Title } from '../../src/ui/components';
import { Select } from '../../src/ui/Select';

export default function BallisticsTab() {
  const guns = useLocalQuery(loadGuns);
  const ammo = useLocalQuery(loadAmmo);
  const profiles = useLocalQuery(loadScopeProfiles);
  const [managing, setManaging] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Title>Ballistics</Title>
        <Button title={managing ? 'Calculator' : 'Scopes'} variant="ghost" onPress={() => setManaging((m) => !m)} />
      </Row>

      {managing ? (
        <ScopeManager guns={guns.data ?? []} profiles={profiles.data ?? []} />
      ) : (
        <Calculator guns={guns.data ?? []} ammo={ammo.data ?? []} profiles={profiles.data ?? []} />
      )}
    </ScrollView>
  );
}

function Calculator({ guns, ammo, profiles }: { guns: Gun[]; ammo: Ammo[]; profiles: ScopeProfile[] }) {
  const [gunId, setGunId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [ammoId, setAmmoId] = useState('');

  const gun = guns.find((g) => g.id === gunId);
  const gunProfiles = profiles.filter((p) => p.gunId === gunId);
  const gunAmmo = gun?.caliber ? ammo.filter((a) => a.caliber === gun.caliber) : ammo;
  const profile = gunProfiles.find((p) => p.id === profileId);

  const [mv, setMv] = useState('');
  const [bc, setBc] = useState('');
  const [dragModel, setDragModel] = useState<DragModel>('G1');
  const [zeroRange, setZeroRange] = useState('100');
  const [sightHeight, setSightHeight] = useState('50');
  const [clickValue, setClickValue] = useState('0.1');
  const [angularUnit, setAngularUnit] = useState<'MRAD' | 'MOA'>('MRAD');
  const [targetRange, setTargetRange] = useState('300');
  const [windSpeed, setWindSpeed] = useState('0');
  const [windAngle, setWindAngle] = useState('90');
  const [showDeriv, setShowDeriv] = useState(false);

  const applyProfile = (p: ScopeProfile | undefined) => {
    if (!p) return;
    setZeroRange(String(p.zeroRangeM));
    setSightHeight(String(p.sightHeightMm));
    setClickValue(String(p.clickValue));
    setAngularUnit(p.angularUnit);
  };
  const applyAmmo = (a: Ammo | undefined) => {
    if (!a) return;
    if (a.muzzleVelocityMps != null) setMv(String(a.muzzleVelocityMps));
    if (a.ballisticCoefficient != null) setBc(String(a.ballisticCoefficient));
    if (a.bcModel) setDragModel(a.bcModel);
  };

  const solution = useMemo(() => {
    const mvNum = Number(mv);
    const bcNum = Number(bc);
    if (!mvNum || !bcNum) return null;
    try {
      return solveFiringSolution({
        muzzleVelocityMps: mvNum,
        ballisticCoefficient: bcNum,
        dragModel,
        sightHeightMm: Number(sightHeight) || 50,
        zeroRangeM: Number(zeroRange) || 100,
        targetRangeM: Number(targetRange) || 100,
        clickValue: Number(clickValue) || 0.1,
        angularUnit,
        windSpeedMps: Number(windSpeed) || 0,
        windAngleDeg: Number(windAngle) || 0,
      });
    } catch {
      return null;
    }
  }, [mv, bc, dragModel, sightHeight, zeroRange, targetRange, clickValue, angularUnit, windSpeed, windAngle]);

  const unit = angularUnit === 'MOA' ? 'MOA' : 'mil';

  return (
    <>
      <Card>
        <Field label="Gun">
          <Select
            value={gunId}
            placeholder="Select gun"
            onChange={(v) => {
              setGunId(v);
              setProfileId('');
              setAmmoId('');
            }}
            options={guns.map((g) => ({ label: g.name, value: g.id }))}
          />
        </Field>
        {gunProfiles.length > 0 && (
          <Field label="Scope profile">
            <Select
              value={profileId}
              placeholder="Manual"
              onChange={(v) => {
                setProfileId(v);
                applyProfile(gunProfiles.find((p) => p.id === v));
              }}
              options={gunProfiles.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Field>
        )}
        <Field label="Ammo (prefill)">
          <Select
            value={ammoId}
            placeholder="Manual"
            onChange={(v) => {
              setAmmoId(v);
              applyAmmo(ammo.find((a) => a.id === v));
            }}
            options={gunAmmo.map((a) => ({ label: a.name, value: a.id }))}
          />
        </Field>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Muzzle vel (m/s)">
              <TextField value={mv} onChangeText={setMv} keyboardType="decimal-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="BC">
              <TextField value={bc} onChangeText={setBc} keyboardType="decimal-pad" />
            </Field>
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Zero (m)">
              <TextField value={zeroRange} onChangeText={setZeroRange} keyboardType="number-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Target (m)">
              <TextField value={targetRange} onChangeText={setTargetRange} keyboardType="number-pad" />
            </Field>
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Wind (m/s)">
              <TextField value={windSpeed} onChangeText={setWindSpeed} keyboardType="decimal-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Wind clock°">
              <TextField value={windAngle} onChangeText={setWindAngle} keyboardType="number-pad" />
            </Field>
          </View>
        </Row>
      </Card>

      <Card>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Firing solution</Text>
        {!solution ? (
          <Subtle>Enter muzzle velocity and BC.</Subtle>
        ) : (
          <>
            <Row style={{ gap: 12 }}>
              <Dial label="Elevation ↑" clicks={solution.elevation.clicks} sub={`${solution.elevation.inScopeUnit.toFixed(2)} ${unit}`} />
              <Dial
                label={solution.windage.clicks >= 0 ? 'Wind → R' : 'Wind ← L'}
                clicks={Math.abs(solution.windage.clicks)}
                sub={`${Math.abs(solution.windage.inScopeUnit).toFixed(2)} ${unit}`}
              />
            </Row>
            <Row style={{ gap: 16, flexWrap: 'wrap' }}>
              <Mini label="Drop" value={`${(solution.dropM * 100).toFixed(0)} cm`} />
              <Mini label="Velocity" value={`${solution.velocityMps.toFixed(0)} m/s`} />
              <Mini label="TOF" value={`${solution.timeOfFlightS.toFixed(2)} s`} />
              <Mini label="Mach" value={`${solution.mach.toFixed(2)}${solution.supersonic ? '' : ' sub'}`} />
            </Row>
            <Button title={showDeriv ? 'Hide derivation' : 'How is this derived?'} variant="ghost" onPress={() => setShowDeriv((v) => !v)} />
            {showDeriv && (
              <View style={{ gap: 6 }}>
                <Subtle>1. The bullet is integrated under gravity + drag (BC scaling the {solution.mach >= 1 ? 'supersonic' : 'subsonic'} curve) after zeroing at {zeroRange} m.</Subtle>
                <Subtle>2. At {targetRange} m it drops {(-solution.dropM * 100).toFixed(0)} cm below the sight line (TOF {solution.timeOfFlightS.toFixed(2)} s).</Subtle>
                <Subtle>3. drop ÷ range = {solution.elevation.mrad.toFixed(2)} mil ({solution.elevation.moa.toFixed(2)} MOA).</Subtle>
                <Subtle>4. ÷ {clickValue} {unit}/click = {solution.elevation.clicks} clicks up.</Subtle>
              </View>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function Dial({ label, clicks, sub }: { label: string; clicks: number; sub: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.inputBg, borderRadius: 12, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: theme.textFaint, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{clicks}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11 }}>clicks · {sub}</Text>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: theme.textFaint, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

// ---- scope profile management ----

function ScopeManager({ guns, profiles }: { guns: Gun[]; profiles: ScopeProfile[] }) {
  const { bump } = useSync();
  const [editing, setEditing] = useState<ScopeProfile | 'new' | null>(null);

  if (guns.length === 0) {
    return <Card><Subtle>Add a gun first — scope profiles belong to a gun.</Subtle></Card>;
  }

  if (editing) {
    return (
      <ScopeForm
        guns={guns}
        profile={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          bump();
        }}
      />
    );
  }

  return (
    <>
      <Button title="+ New scope profile" onPress={() => setEditing('new')} />
      {profiles.map((p) => {
        const gun = guns.find((g) => g.id === p.gunId);
        return (
          <Card key={p.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{p.name}</Text>
                <Subtle>{gun?.name ?? '—'} · {p.clickValue} {p.angularUnit}/click · zero {p.zeroRangeM} m</Subtle>
              </View>
              <Button title="Edit" variant="ghost" onPress={() => setEditing(p)} />
            </Row>
          </Card>
        );
      })}
      {profiles.length === 0 && <Card><Subtle>No scope profiles yet.</Subtle></Card>}
    </>
  );
}

function ScopeForm({ guns, profile, onDone }: { guns: Gun[]; profile: ScopeProfile | null; onDone: () => void }) {
  const [gunId, setGunId] = useState(profile?.gunId ?? guns[0]?.id ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const [clickValue, setClickValue] = useState(String(profile?.clickValue ?? 0.1));
  const [angularUnit, setAngularUnit] = useState<'MRAD' | 'MOA'>(profile?.angularUnit ?? 'MRAD');
  const [zeroRangeM, setZeroRangeM] = useState(String(profile?.zeroRangeM ?? 100));
  const [sightHeightMm, setSightHeightMm] = useState(String(profile?.sightHeightMm ?? 50));

  const save = async () => {
    if (!name.trim() || !gunId) return;
    await saveScopeProfile({
      id: profile?.id,
      gunId,
      name: name.trim(),
      clickValue: Number(clickValue) || 0.1,
      angularUnit,
      zeroRangeM: Number(zeroRangeM) || 100,
      sightHeightMm: Number(sightHeightMm) || 50,
      notes: profile?.notes ?? null,
    });
    onDone();
  };

  return (
    <Card>
      <Field label="Gun">
        <Select value={gunId} onChange={setGunId} options={guns.map((g) => ({ label: g.name, value: g.id }))} />
      </Field>
      <Field label="Name">
        <TextField value={name} onChangeText={setName} placeholder="e.g. Vortex PST" />
      </Field>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Click value">
            <TextField value={clickValue} onChangeText={setClickValue} keyboardType="decimal-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Unit">
            <Select
              value={angularUnit}
              onChange={(v) => setAngularUnit(v as 'MRAD' | 'MOA')}
              options={[
                { label: 'MRAD', value: 'MRAD' },
                { label: 'MOA', value: 'MOA' },
              ]}
            />
          </Field>
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Zero range (m)">
            <TextField value={zeroRangeM} onChangeText={setZeroRangeM} keyboardType="number-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Sight height (mm)">
            <TextField value={sightHeightMm} onChangeText={setSightHeightMm} keyboardType="decimal-pad" />
          </Field>
        </View>
      </Row>
      <Button title="Save" onPress={save} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="ghost" onPress={onDone} />
        </View>
        {profile && (
          <View style={{ flex: 1 }}>
            <Button
              title="Delete"
              variant="danger"
              onPress={async () => {
                await deleteScopeProfile(profile.id);
                onDone();
              }}
            />
          </View>
        )}
      </Row>
    </Card>
  );
}
