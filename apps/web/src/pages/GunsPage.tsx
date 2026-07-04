import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateGunInput, Gun } from '@armory/shared';
import { ApiError, gunsApi } from '../lib/api';
import { AuthImage } from '../components/AuthImage';
import { ImageField } from '../components/ImageField';
import { Button, Card, Field, Input, Textarea } from '../components/ui';

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function GunsPage() {
  const qc = useQueryClient();
  const { data: guns, isLoading } = useQuery({ queryKey: ['guns'], queryFn: gunsApi.list });
  const [editing, setEditing] = useState<Gun | 'new' | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['guns'] });
  const remove = useMutation({ mutationFn: gunsApi.remove, onSuccess: invalidate });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Guns</h1>
        {editing === null && <Button onClick={() => setEditing('new')}>+ New gun</Button>}
      </div>

      {editing !== null && (
        <GunForm
          gun={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null);
            invalidate();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : !guns || guns.length === 0 ? (
        editing === null && <p className="text-neutral-500">No guns yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {guns.map((gun) => (
            <Card key={gun.id} className="flex gap-4">
              {gun.imagePath ? (
                <AuthImage
                  filename={gun.imagePath}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-neutral-200 text-3xl dark:bg-neutral-800">
                  🔫
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{gun.name}</h3>
                    {gun.caliber && <p className="text-sm text-neutral-500">{gun.caliber}</p>}
                  </div>
                  {gun.cleaningDue && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Clean due
                    </span>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-neutral-500">
                  <div>
                    <dt className="inline">Rounds: </dt>
                    <dd className="inline text-neutral-700 dark:text-neutral-200">{gun.roundsFired}</dd>
                  </div>
                  {gun.cleaningIntervalRounds != null && (
                    <div>
                      <dt className="inline">Since clean: </dt>
                      <dd className="inline text-neutral-700 dark:text-neutral-200">
                        {gun.roundsSinceCleaning}/{gun.cleaningIntervalRounds}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(gun)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${gun.name}"?`)) remove.mutate(gun.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GunForm({
  gun,
  onDone,
  onCancel,
}: {
  gun: Gun | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(gun?.name ?? '');
  const [caliber, setCaliber] = useState(gun?.caliber ?? '');
  const [purchasePrice, setPurchasePrice] = useState(gun?.purchasePrice?.toString() ?? '');
  const [purchaseDate, setPurchaseDate] = useState(gun?.purchaseDate?.slice(0, 10) ?? '');
  const [initialRoundCount, setInitialRoundCount] = useState(
    (gun?.initialRoundCount ?? 0).toString(),
  );
  const [cleaningInterval, setCleaningInterval] = useState(
    gun?.cleaningIntervalRounds?.toString() ?? '',
  );
  const [lastCleaned, setLastCleaned] = useState((gun?.lastCleanedAtRound ?? 0).toString());
  const [notes, setNotes] = useState(gun?.notes ?? '');
  const [imagePath, setImagePath] = useState<string | null>(gun?.imagePath ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: CreateGunInput) =>
      gun ? gunsApi.update(gun.id, input) : gunsApi.create(input),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to save'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate({
      name: name.trim(),
      caliber: caliber.trim() || null,
      purchasePrice: numOrNull(purchasePrice),
      purchaseDate: purchaseDate || null,
      initialRoundCount: Number(initialRoundCount || '0'),
      cleaningIntervalRounds: numOrNull(cleaningInterval),
      lastCleanedAtRound: Number(lastCleaned || '0'),
      notes: notes.trim() || null,
      imagePath,
    });
  };

  return (
    <Card>
      <h2 className="mb-4 font-medium">{gun ? 'Edit gun' : 'New gun'}</h2>
      <form onSubmit={submit} className="space-y-4">
        <ImageField value={imagePath} onChange={setImagePath} placeholder="🔫" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Caliber">
            <Input value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="9mm Luger" />
          </Field>
          <Field label="Purchase price">
            <Input
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </Field>
          <Field label="Purchase date">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Initial round count">
            <Input
              type="number"
              value={initialRoundCount}
              onChange={(e) => setInitialRoundCount(e.target.value)}
            />
          </Field>
          <Field label="Clean every N rounds (optional)">
            <Input
              type="number"
              value={cleaningInterval}
              onChange={(e) => setCleaningInterval(e.target.value)}
            />
          </Field>
          <Field label="Last cleaned at round">
            <Input type="number" value={lastCleaned} onChange={(e) => setLastCleaned(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
