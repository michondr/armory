import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildRangeCard,
  solveFiringSolution,
  type AngularUnit as BcAngularUnit,
  type DragModel,
  type FiringSolutionInputs,
} from '@armory/ballistics';
import {
  fpsToMps,
  metersToYards,
  mpsToFps,
  yardsToMeters,
  type Ammo,
  type CreateScopeProfileInput,
  type Gun,
  type ScopeProfile,
  type UserSettings,
} from '@armory/shared';
import { ammoApi, ApiError, gunsApi, scopeProfilesApi, settingsApi } from '../lib/api';
import { Modal } from '../components/Modal';
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui';

const num = (s: string): number => Number(s);
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

interface Units {
  imperial: boolean;
  rangeLabel: string;
  velLabel: string;
  toRangeM: (display: number) => number;
  fromRangeM: (m: number) => number;
  toVelMps: (display: number) => number;
  fromVelMps: (mps: number) => number;
  dropLabel: string;
  fromDropM: (m: number) => number;
}

function unitsFor(settings: UserSettings | undefined): Units {
  const imperial = settings?.unitSystem === 'IMPERIAL';
  return imperial
    ? {
        imperial,
        rangeLabel: 'yd',
        velLabel: 'fps',
        toRangeM: yardsToMeters,
        fromRangeM: metersToYards,
        toVelMps: fpsToMps,
        fromVelMps: mpsToFps,
        dropLabel: 'in',
        fromDropM: (m) => (m * 1000) / 25.4,
      }
    : {
        imperial,
        rangeLabel: 'm',
        velLabel: 'm/s',
        toRangeM: (v) => v,
        fromRangeM: (v) => v,
        toVelMps: (v) => v,
        fromVelMps: (v) => v,
        dropLabel: 'cm',
        fromDropM: (m) => m * 100,
      };
}

export function BallisticsPage() {
  const { data: guns } = useQuery({ queryKey: ['guns'], queryFn: gunsApi.list });
  const { data: ammo } = useQuery({ queryKey: ['ammo'], queryFn: () => ammoApi.list() });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const { data: profiles } = useQuery({
    queryKey: ['scope-profiles'],
    queryFn: () => scopeProfilesApi.list(),
  });

  const [managing, setManaging] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ballistics</h1>
        <Button variant="ghost" onClick={() => setManaging(true)}>
          Scope profiles
        </Button>
      </div>

      <Calculator
        guns={guns ?? []}
        ammo={ammo ?? []}
        profiles={profiles ?? []}
        settings={settings}
      />

      {managing && (
        <Modal title="Scope profiles" onClose={() => setManaging(false)}>
          <ScopeProfileManager guns={guns ?? []} profiles={profiles ?? []} />
        </Modal>
      )}
    </div>
  );
}

function Calculator({
  guns,
  ammo,
  profiles,
  settings,
}: {
  guns: Gun[];
  ammo: Ammo[];
  profiles: ScopeProfile[];
  settings: UserSettings | undefined;
}) {
  const u = useMemo(() => unitsFor(settings), [settings]);

  const [gunId, setGunId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [ammoId, setAmmoId] = useState('');

  const gunProfiles = profiles.filter((p) => p.gunId === gunId);
  const gun = guns.find((g) => g.id === gunId);
  const gunAmmo = gun?.caliber ? ammo.filter((a) => a.caliber === gun.caliber) : ammo;
  const profile = gunProfiles.find((p) => p.id === profileId);
  const selectedAmmo = ammo.find((a) => a.id === ammoId);

  // Ballistic inputs (in display units where relevant). Prefilled from ammo/profile
  // but editable so you can model a load you haven't saved.
  const [muzzleVelocity, setMuzzleVelocity] = useState('');
  const [bc, setBc] = useState('');
  const [dragModel, setDragModel] = useState<DragModel>('G1');
  const [sightHeightMm, setSightHeightMm] = useState('50');
  const [zeroRange, setZeroRange] = useState(String(u.imperial ? 100 : 100));
  const [clickValue, setClickValue] = useState('0.1');
  const [angularUnit, setAngularUnit] = useState<BcAngularUnit>('MRAD');
  const [targetRange, setTargetRange] = useState(String(u.imperial ? 500 : 500));
  const [windSpeed, setWindSpeed] = useState('0');
  const [windAngle, setWindAngle] = useState('90');
  const [tempC, setTempC] = useState('15');
  const [pressureHpa, setPressureHpa] = useState('1013');
  const [humidity, setHumidity] = useState('50');
  const [showDerivation, setShowDerivation] = useState(false);

  const applyProfile = (p: ScopeProfile | undefined) => {
    if (!p) return;
    setSightHeightMm(String(p.sightHeightMm));
    setZeroRange(String(Math.round(u.fromRangeM(p.zeroRangeM))));
    setClickValue(String(p.clickValue));
    setAngularUnit(p.angularUnit);
  };

  const applyAmmo = (a: Ammo | undefined) => {
    if (!a) return;
    if (a.muzzleVelocityMps != null) setMuzzleVelocity(String(Math.round(u.fromVelMps(a.muzzleVelocityMps))));
    if (a.ballisticCoefficient != null) setBc(String(a.ballisticCoefficient));
    if (a.bcModel) setDragModel(a.bcModel);
  };

  const solverInputs: FiringSolutionInputs | null = useMemo(() => {
    const mv = u.toVelMps(num(muzzleVelocity));
    const bcVal = num(bc);
    if (!mv || !bcVal || Number.isNaN(mv) || Number.isNaN(bcVal)) return null;
    return {
      muzzleVelocityMps: mv,
      ballisticCoefficient: bcVal,
      dragModel,
      sightHeightMm: num(sightHeightMm) || 50,
      zeroRangeM: u.toRangeM(num(zeroRange)) || 100,
      targetRangeM: u.toRangeM(num(targetRange)) || 100,
      clickValue: num(clickValue) || 0.1,
      angularUnit,
      windSpeedMps: num(windSpeed) || 0,
      windAngleDeg: num(windAngle) || 0,
      atmosphere: {
        temperatureC: num(tempC),
        pressureHpa: num(pressureHpa) || 1013.25,
        humidity: (num(humidity) || 0) / 100,
      },
    };
  }, [u, muzzleVelocity, bc, dragModel, sightHeightMm, zeroRange, targetRange, clickValue, angularUnit, windSpeed, windAngle, tempC, pressureHpa, humidity]);

  const solution = useMemo(() => {
    if (!solverInputs) return null;
    try {
      return solveFiringSolution(solverInputs);
    } catch {
      return null;
    }
  }, [solverInputs]);

  const rangeCard = useMemo(() => {
    if (!solverInputs) return [];
    const maxM = solverInputs.targetRangeM;
    const stepM = u.toRangeM(u.imperial ? 100 : 100);
    const ranges: number[] = [];
    for (let r = stepM; r <= maxM + 1; r += stepM) ranges.push(r);
    if (ranges.length === 0) ranges.push(maxM);
    try {
      return buildRangeCard(solverInputs, ranges);
    } catch {
      return [];
    }
  }, [solverInputs, u]);

  const unitSuffix = angularUnit === 'MOA' ? 'MOA' : 'mil';
  const dialValue = (clicks: number, perClick: number) => (clicks * perClick).toFixed(angularUnit === 'MOA' ? 2 : 1);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <h2 className="font-medium">Rifle &amp; load</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gun">
            <Select
              value={gunId}
              onChange={(e) => {
                setGunId(e.target.value);
                setProfileId('');
                setAmmoId('');
              }}
            >
              <option value="">— select —</option>
              {guns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope profile">
            <Select
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                applyProfile(gunProfiles.find((p) => p.id === e.target.value));
              }}
              disabled={!gunId}
            >
              <option value="">— manual —</option>
              {gunProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ammo (prefill)">
            <Select
              value={ammoId}
              onChange={(e) => {
                setAmmoId(e.target.value);
                applyAmmo(ammo.find((a) => a.id === e.target.value));
              }}
            >
              <option value="">— manual —</option>
              {gunAmmo.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Muzzle velocity (${u.velLabel})`}>
            <Input type="number" value={muzzleVelocity} onChange={(e) => setMuzzleVelocity(e.target.value)} />
          </Field>
          <Field label="Ballistic coefficient">
            <Input type="number" step="0.001" value={bc} onChange={(e) => setBc(e.target.value)} />
          </Field>
          <Field label="Drag model">
            <Select value={dragModel} onChange={(e) => setDragModel(e.target.value as DragModel)}>
              <option value="G1">G1</option>
              <option value="G7">G7</option>
            </Select>
          </Field>
          <Field label="Sight height (mm)">
            <Input type="number" value={sightHeightMm} onChange={(e) => setSightHeightMm(e.target.value)} />
          </Field>
          <Field label={`Zero range (${u.rangeLabel})`}>
            <Input type="number" value={zeroRange} onChange={(e) => setZeroRange(e.target.value)} />
          </Field>
          <Field label="Click value">
            <div className="flex gap-2">
              <Input type="number" step="0.01" value={clickValue} onChange={(e) => setClickValue(e.target.value)} />
              <Select value={angularUnit} onChange={(e) => setAngularUnit(e.target.value as BcAngularUnit)} className="w-28">
                <option value="MRAD">MRAD</option>
                <option value="MOA">MOA</option>
              </Select>
            </div>
          </Field>
        </div>

        <h2 className="pt-2 font-medium">Shot</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Target range (${u.rangeLabel})`}>
            <Input type="number" value={targetRange} onChange={(e) => setTargetRange(e.target.value)} />
          </Field>
          <Field label="Wind speed (m/s)">
            <Input type="number" step="0.1" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
          </Field>
          <Field label="Wind from (clock°: 0=head, 90=right)">
            <Input type="number" value={windAngle} onChange={(e) => setWindAngle(e.target.value)} />
          </Field>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-500">Atmosphere</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Temp (°C)">
              <Input type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} />
            </Field>
            <Field label="Pressure (hPa)">
              <Input type="number" value={pressureHpa} onChange={(e) => setPressureHpa(e.target.value)} />
            </Field>
            <Field label="Humidity (%)">
              <Input type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} />
            </Field>
          </div>
        </details>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-medium">Firing solution</h2>
          {!solution ? (
            <p className="text-neutral-500">Enter muzzle velocity and BC to compute a solution.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Dial
                  label="Elevation ↑"
                  clicks={solution.elevation.clicks}
                  dial={dialValue(solution.elevation.clicks, num(clickValue))}
                  unit={unitSuffix}
                />
                <Dial
                  label={solution.windage.clicks >= 0 ? 'Windage → R' : 'Windage ← L'}
                  clicks={Math.abs(solution.windage.clicks)}
                  dial={dialValue(Math.abs(solution.windage.clicks), num(clickValue))}
                  unit={unitSuffix}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-500">
                <Stat label="Drop" value={`${u.fromDropM(solution.dropM).toFixed(1)} ${u.dropLabel}`} />
                <Stat label="Velocity" value={`${Math.round(u.fromVelMps(solution.velocityMps))} ${u.velLabel}`} />
                <Stat label="Time of flight" value={`${solution.timeOfFlightS.toFixed(2)} s`} />
                <Stat label="Mach" value={`${solution.mach.toFixed(2)}${solution.supersonic ? '' : ' (subsonic)'}`} />
              </dl>

              <button
                type="button"
                onClick={() => setShowDerivation((v) => !v)}
                className="mt-4 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
              >
                {showDerivation ? 'Hide' : 'How is this derived?'}
              </button>
              {showDerivation && <Derivation solution={solution} u={u} clickValue={num(clickValue)} angularUnit={angularUnit} />}
            </>
          )}
        </Card>

        {rangeCard.length > 0 && (
          <Card>
            <h2 className="mb-3 font-medium">Come-up table</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="py-1 pr-4">Range ({u.rangeLabel})</th>
                    <th className="py-1 pr-4">Elev ({unitSuffix})</th>
                    <th className="py-1 pr-4">Wind ({unitSuffix})</th>
                    <th className="py-1">Vel ({u.velLabel})</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeCard.map((row) => (
                    <tr key={row.rangeM} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="py-1 pr-4">{Math.round(u.fromRangeM(row.rangeM))}</td>
                      <td className="py-1 pr-4">{row.elevation.inScopeUnit.toFixed(angularUnit === 'MOA' ? 1 : 2)}</td>
                      <td className="py-1 pr-4">{row.windage.inScopeUnit.toFixed(angularUnit === 'MOA' ? 1 : 2)}</td>
                      <td className="py-1">{Math.round(u.fromVelMps(row.velocityMps))}{row.supersonic ? '' : ' ⚠'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Dial({ label, clicks, dial, unit }: { label: string; clicks: number; dial: string; unit: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 p-4 text-center dark:bg-neutral-800">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{clicks}</div>
      <div className="text-xs text-neutral-500">clicks · {dial} {unit}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline">{label}: </dt>
      <dd className="inline font-medium text-neutral-700 dark:text-neutral-200">{value}</dd>
    </div>
  );
}

function Derivation({
  solution,
  u,
  clickValue,
  angularUnit,
}: {
  solution: ReturnType<typeof solveFiringSolution>;
  u: Units;
  clickValue: number;
  angularUnit: BcAngularUnit;
}) {
  const e = solution.elevation;
  const angularVal = angularUnit === 'MOA' ? e.moa : e.mrad;
  return (
    <ol className="mt-3 space-y-2 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      <li>
        <b>1. Trajectory.</b> The bullet is integrated step-by-step under gravity and aerodynamic drag
        (its BC scaling the {solution.mach >= 1 ? 'supersonic' : 'subsonic'} drag curve), after finding the
        launch angle that zeroes at your zero range.
      </li>
      <li>
        <b>2. Drop at range.</b> At the target it sits{' '}
        <b>{u.fromDropM(-solution.dropM).toFixed(1)} {u.dropLabel}</b> below the line of sight
        (time of flight {solution.timeOfFlightS.toFixed(2)} s).
      </li>
      <li>
        <b>3. Angle.</b> drop ÷ range → <b>{e.mrad.toFixed(2)} mil</b> ({e.moa.toFixed(2)} MOA).
      </li>
      <li>
        <b>4. Clicks.</b> {angularVal.toFixed(2)} {angularUnit === 'MOA' ? 'MOA' : 'mil'} ÷ {clickValue}{' '}
        per click → <b>{e.clicks} clicks</b> up.
      </li>
    </ol>
  );
}

// ---- scope profile manager ----

function ScopeProfileManager({ guns, profiles }: { guns: Gun[]; profiles: ScopeProfile[] }) {
  const [editing, setEditing] = useState<ScopeProfile | 'new' | null>(null);

  return (
    <div className="space-y-4">
      {guns.length === 0 ? (
        <p className="text-neutral-500">Add a gun first — scope profiles belong to a gun.</p>
      ) : (
        <>
          {profiles.length === 0 ? (
            <p className="text-neutral-500">No scope profiles yet.</p>
          ) : (
            <ul className="space-y-2">
              {profiles.map((p) => {
                const gun = guns.find((g) => g.id === p.gunId);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-500">
                        {gun?.name ?? '—'} · {p.clickValue} {p.angularUnit}/click · zero{' '}
                        {p.zeroRangeM} m
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {editing === null && <Button onClick={() => setEditing('new')}>+ New profile</Button>}
        </>
      )}

      {editing !== null && (
        <ScopeProfileForm
          guns={guns}
          profile={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ScopeProfileForm({
  guns,
  profile,
  onDone,
}: {
  guns: Gun[];
  profile: ScopeProfile | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['scope-profiles'] });

  const [gunId, setGunId] = useState(profile?.gunId ?? guns[0]?.id ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const [clickValue, setClickValue] = useState(String(profile?.clickValue ?? 0.1));
  const [angularUnit, setAngularUnit] = useState<BcAngularUnit>(profile?.angularUnit ?? 'MRAD');
  const [zeroRangeM, setZeroRangeM] = useState(String(profile?.zeroRangeM ?? 100));
  const [sightHeightMm, setSightHeightMm] = useState(String(profile?.sightHeightMm ?? 50));
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: CreateScopeProfileInput) =>
      profile ? scopeProfilesApi.update(profile.id, input) : scopeProfilesApi.create(input),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to save'),
  });
  const del = useMutation({
    mutationFn: () => scopeProfilesApi.remove(profile!.id),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate({
      gunId,
      name: name.trim(),
      clickValue: num(clickValue),
      angularUnit,
      zeroRangeM: num(zeroRangeM),
      sightHeightMm: num(sightHeightMm),
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gun">
          <Select value={gunId} onChange={(e) => setGunId(e.target.value)}>
            {guns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vortex PST 5-25" />
        </Field>
        <Field label="Click value">
          <div className="flex gap-2">
            <Input type="number" step="0.01" value={clickValue} onChange={(e) => setClickValue(e.target.value)} />
            <Select value={angularUnit} onChange={(e) => setAngularUnit(e.target.value as BcAngularUnit)} className="w-28">
              <option value="MRAD">MRAD</option>
              <option value="MOA">MOA</option>
            </Select>
          </div>
        </Field>
        <Field label="Zero range (m)">
          <Input type="number" value={zeroRangeM} onChange={(e) => setZeroRangeM(e.target.value)} />
        </Field>
        <Field label="Sight height (mm)">
          <Input type="number" value={sightHeightMm} onChange={(e) => setSightHeightMm(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : profile ? 'Save' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {profile && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${profile.name}"?`)) del.mutate();
            }}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
