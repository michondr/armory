import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ANGULAR_UNITS, UNIT_SYSTEMS, type UpdateSettingsInput } from '@armory/shared';
import { ApiError, settingsApi } from '../lib/api';
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
    </div>
  );
}
