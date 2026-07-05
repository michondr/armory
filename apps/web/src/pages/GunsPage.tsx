import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateGunInput, Gun } from '@armory/shared';
import { ApiError, gunsApi } from '../lib/api';
import { AuthImage } from '../components/AuthImage';
import { CaliberSelect } from '../components/CaliberSelect';
import { ImageField } from '../components/ImageField';
import { Modal } from '../components/Modal';
import { Button, Field, Input, Textarea } from '../components/ui';

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function GunsPage() {
  const { data: guns, isLoading } = useQuery({ queryKey: ['guns'], queryFn: gunsApi.list });
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const editingGun =
    editingId && editingId !== 'new' ? (guns?.find((g) => g.id === editingId) ?? null) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Guns</h1>
        <Button onClick={() => setEditingId('new')}>+ New gun</Button>
      </div>

      {isLoading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : !guns || guns.length === 0 ? (
        <p className="text-neutral-500">No guns yet. Add your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {guns.map((gun) => (
            <GunCard key={gun.id} gun={gun} onOpen={() => setEditingId(gun.id)} />
          ))}
        </div>
      )}

      {editingId !== null && (
        <Modal title={editingGun ? editingGun.name : 'New gun'} onClose={() => setEditingId(null)}>
          <GunDetail gun={editingGun} onClose={() => setEditingId(null)} />
        </Modal>
      )}
    </div>
  );
}

function GunCard({ gun, onOpen }: { gun: Gun; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-emerald-500/60 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      {gun.imagePath ? (
        <AuthImage filename={gun.imagePath} className="h-24 w-24 shrink-0 rounded-lg object-cover" />
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
      </div>
    </button>
  );
}

function GunDetail({ gun, onClose }: { gun: Gun | null; onClose: () => void }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['guns'] });

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
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to save'),
  });

  const del = useMutation({
    mutationFn: () => gunsApi.remove(gun!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
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
    <form onSubmit={submit} className="space-y-5">
      <ImageField value={imagePath} onChange={setImagePath} placeholder="🔫" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Caliber">
          <CaliberSelect value={caliber} onChange={setCaliber} />
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

      <div className="flex items-center gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : gun ? 'Save' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {gun && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${gun.name}"?`)) del.mutate();
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
