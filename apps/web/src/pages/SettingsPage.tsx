import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ANGULAR_UNITS, UNIT_SYSTEMS, type UpdateSettingsInput } from '@armory/shared';
import {
  ApiError,
  cartridgesApi,
  scoringTest,
  settingsApi,
  type ScoreTestResult,
} from '../lib/api';
import { AuthImage } from '../components/AuthImage';
import { Button, Card, Field, Input, Select } from '../components/ui';

interface FormState {
  unitSystem: string;
  angularUnit: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpPass: string;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        unitSystem: data.unitSystem,
        angularUnit: data.angularUnit,
        smtpHost: data.smtpHost ?? '',
        smtpPort: data.smtpPort?.toString() ?? '',
        smtpUser: data.smtpUser ?? '',
        smtpFrom: data.smtpFrom ?? '',
        smtpPass: '',
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: (input: UpdateSettingsInput) => settingsApi.update(input),
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res);
      setSaved(true);
      setForm((f) => (f ? { ...f, smtpPass: '' } : f));
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  if (!form || !data) return <p className="text-neutral-500">Loading…</p>;

  const set = (patch: Partial<FormState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setSaved(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: UpdateSettingsInput = {
      unitSystem: form.unitSystem as UpdateSettingsInput['unitSystem'],
      angularUnit: form.angularUnit as UpdateSettingsInput['angularUnit'],
      smtpHost: form.smtpHost.trim() || null,
      smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
      smtpUser: form.smtpUser.trim() || null,
      smtpFrom: form.smtpFrom.trim() || null,
    };
    if (form.smtpPass) payload.smtpPass = form.smtpPass;
    mutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <h2 className="mb-4 font-medium">Units</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Measurement system">
              <Select
                value={form.unitSystem}
                onChange={(e) => set({ unitSystem: e.target.value })}
              >
                {UNIT_SYSTEMS.map((u) => (
                  <option key={u} value={u}>
                    {u === 'METRIC' ? 'Metric (m, cm, m/s, g)' : 'Imperial (yd, in, fps, gr)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Scope adjustment unit">
              <Select
                value={form.angularUnit}
                onChange={(e) => set({ angularUnit: e.target.value })}
              >
                {ANGULAR_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Email (SMTP)</h2>
            <span className="text-xs text-neutral-500">
              {data.smtpPassSet ? 'Password saved ✓' : 'No password set'}
            </span>
          </div>
          <p className="mb-4 text-sm text-neutral-500">
            Used to notify you when target scoring finishes. The password is encrypted at rest and
            never returned.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Host">
              <Input value={form.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={form.smtpPort}
                onChange={(e) => set({ smtpPort: e.target.value })}
              />
            </Field>
            <Field label="Username">
              <Input value={form.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} />
            </Field>
            <Field label="From address">
              <Input
                type="email"
                value={form.smtpFrom}
                onChange={(e) => set({ smtpFrom: e.target.value })}
              />
            </Field>
            <Field label="Password (leave blank to keep)">
              <Input
                type="password"
                value={form.smtpPass}
                onChange={(e) => set({ smtpPass: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </form>

      <CartridgesCard />
      <ScoringTestCard />
    </div>
  );
}

function ScoringTestCard() {
  const [file, setFile] = useState<File | null>(null);
  const [shotCount, setShotCount] = useState('0');
  const [maxScore, setMaxScore] = useState('10');
  const [result, setResult] = useState<ScoreTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await scoringTest(file, Number(shotCount || '0'), Number(maxScore || '10')));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Scoring failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-1 font-medium">Scoring test</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Upload a target photo to see what the scorer detects — for tuning. Leave shots at 0 to
        detect all; set it to cap the count.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-600 dark:text-neutral-300">Photo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <Field label="Shots (0 = all)">
          <Input
            type="number"
            value={shotCount}
            onChange={(e) => setShotCount(e.target.value)}
            className="w-24"
          />
        </Field>
        <Field label="Max score/shot">
          <Input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="w-28"
          />
        </Field>
        <Button type="button" onClick={run} disabled={!file || busy}>
          {busy ? 'Scoring…' : 'Run test'}
        </Button>
      </div>

      {busy && (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600" />
          Detecting holes…
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {result && !busy && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            <b>{result.shots.length}</b> holes detected · total <b>{result.total}</b>
            {result.shots.length === 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}
                — nothing found; try a flatter, well-lit, straight-on photo
              </span>
            )}
          </p>
          <div className="relative inline-block max-w-full">
            <AuthImage
              filename={result.imagePath}
              className="block max-h-96 w-auto max-w-full rounded-lg"
            />
            {result.shots.map((s, i) => (
              <span
                key={i}
                style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
                className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-500 bg-black/50 text-[9px] font-bold text-white"
              >
                {s.ring}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CartridgesCard() {
  const qc = useQueryClient();
  const { data: cartridges } = useQuery({ queryKey: ['cartridges'], queryFn: cartridgesApi.list });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cartridges'] });

  const add = useMutation({
    mutationFn: () => cartridgesApi.create({ name: name.trim() }),
    onSuccess: () => {
      setName('');
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to add'),
  });
  const del = useMutation({
    mutationFn: (id: string) => cartridgesApi.remove(id),
    onSuccess: invalidate,
  });
  const defaults = useMutation({ mutationFn: () => cartridgesApi.addDefaults(), onSuccess: invalidate });

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-medium">Cartridges</h2>
        <Button
          type="button"
          variant="ghost"
          onClick={() => defaults.mutate()}
          disabled={defaults.isPending}
        >
          {defaults.isPending ? 'Adding…' : 'Add common + used'}
        </Button>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        The caliber options for guns and ammo. Matching names let sessions filter ammo by gun.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(cartridges ?? []).map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800"
          >
            {c.name}
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete cartridge "${c.name}"?`)) del.mutate(c.id);
              }}
              className="text-neutral-400 hover:text-red-500"
              aria-label={`Delete ${c.name}`}
            >
              ✕
            </button>
          </span>
        ))}
        {cartridges && cartridges.length === 0 && (
          <span className="text-sm text-neutral-400">No cartridges yet.</span>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
        className="flex items-end gap-2"
      >
        <Field label="Add cartridge">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 6.5 PRC" />
        </Field>
        <Button type="submit" disabled={add.isPending}>
          Add
        </Button>
      </form>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </Card>
  );
}
