import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BC_MODELS,
  type Ammo,
  type AmmoSuggestion,
  type CreateAmmoInput,
} from '@armory/shared';
import { ammoApi, ApiError, uploadImage } from '../lib/api';
import {
  useUnitSystem,
  velocityFromMps,
  velocityToMps,
  velocityUnit,
  weightFromG,
  weightToG,
  weightUnit,
} from '../lib/units';
import { AuthImage } from '../components/AuthImage';
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui';

const today = (): string => new Date().toISOString().slice(0, 10);
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function AmmoPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const { data: ammo, isLoading } = useQuery({
    queryKey: ['ammo', q],
    queryFn: () => ammoApi.list(q || undefined),
  });
  const [editing, setEditing] = useState<Ammo | 'new' | null>(null);
  const [pricesFor, setPricesFor] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });
  const remove = useMutation({ mutationFn: ammoApi.remove, onSuccess: invalidate });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ammo</h1>
        {editing === null && <Button onClick={() => setEditing('new')}>+ New ammo</Button>}
      </div>

      <Input
        placeholder="Search by name, caliber, notes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {editing !== null && (
        <AmmoForm
          ammo={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null);
            invalidate();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : !ammo || ammo.length === 0 ? (
        editing === null && <p className="text-neutral-500">No ammo found.</p>
      ) : (
        <div className="space-y-4">
          {ammo.map((a) => (
            <AmmoCard
              key={a.id}
              ammo={a}
              showPrices={pricesFor === a.id}
              onTogglePrices={() => setPricesFor((cur) => (cur === a.id ? null : a.id))}
              onEdit={() => setEditing(a)}
              onDelete={() => {
                if (confirm(`Delete "${a.name}"?`)) remove.mutate(a.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AmmoCard({
  ammo,
  showPrices,
  onTogglePrices,
  onEdit,
  onDelete,
}: {
  ammo: Ammo;
  showPrices: boolean;
  onTogglePrices: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const system = useUnitSystem();
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4">
        {ammo.images[0] ? (
          <AuthImage
            filename={ammo.images[0].imagePath}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-neutral-200 text-2xl dark:bg-neutral-800">
            🧊
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{ammo.name}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-neutral-500">
            {ammo.caliber && <span>{ammo.caliber}</span>}
            {ammo.bulletWeightG != null && (
              <span>
                {weightFromG(ammo.bulletWeightG, system)} {weightUnit(system)}
              </span>
            )}
            {ammo.muzzleVelocityMps != null && (
              <span>
                {velocityFromMps(ammo.muzzleVelocityMps, system)} {velocityUnit(system)}
              </span>
            )}
            {ammo.ballisticCoefficient != null && (
              <span>
                BC {ammo.ballisticCoefficient} {ammo.bcModel ?? ''}
              </span>
            )}
          </div>
          {ammo.lastPricePerRound != null && (
            <p className="mt-1 text-sm text-neutral-500">
              Last {ammo.lastPricePerRound.toFixed(2)} {ammo.priceEntries[0]?.currency}/rd ·{' '}
              {ammo.roundsPurchased} rds bought
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onTogglePrices}>
            Prices ({ammo.priceEntries.length})
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      {showPrices && <PriceLog ammo={ammo} />}
    </Card>
  );
}

function PriceLog({ ammo }: { ammo: Ammo }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });
  const [date, setDate] = useState(today());
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('CZK');
  const [quantity, setQuantity] = useState('50');
  const [vendor, setVendor] = useState('');

  const add = useMutation({
    mutationFn: () =>
      ammoApi.addPrice(ammo.id, {
        date,
        pricePerRound: Number(price),
        currency,
        quantity: Number(quantity || '1'),
        vendor: vendor.trim() || null,
      }),
    onSuccess: () => {
      setPrice('');
      setVendor('');
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: (entryId: string) => ammoApi.deletePrice(ammo.id, entryId),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {ammo.priceEntries.length > 0 && (
        <table className="mb-3 w-full text-sm">
          <tbody>
            {ammo.priceEntries.map((p) => (
              <tr key={p.id} className="text-neutral-600 dark:text-neutral-300">
                <td className="py-1">{p.date.slice(0, 10)}</td>
                <td>
                  {p.pricePerRound.toFixed(2)} {p.currency}/rd
                </td>
                <td>×{p.quantity}</td>
                <td className="text-neutral-400">{p.vendor}</td>
                <td className="text-right">
                  <button
                    onClick={() => del.mutate(p.id)}
                    className="text-neutral-400 hover:text-red-500"
                    aria-label="Delete price entry"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Input
          type="number"
          step="0.01"
          required
          placeholder="price/rd"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-28"
        />
        <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-20" />
        <Input
          type="number"
          placeholder="qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="w-36"
        />
        <Button type="submit" disabled={add.isPending}>
          Add
        </Button>
      </form>
    </div>
  );
}

function AmmoForm({
  ammo,
  onDone,
  onCancel,
}: {
  ammo: Ammo | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const system = useUnitSystem();
  const [name, setName] = useState(ammo?.name ?? '');
  const [caliber, setCaliber] = useState(ammo?.caliber ?? '');
  const [weight, setWeight] = useState(
    ammo?.bulletWeightG != null ? weightFromG(ammo.bulletWeightG, system).toString() : '',
  );
  const [velocity, setVelocity] = useState(
    ammo?.muzzleVelocityMps != null ? velocityFromMps(ammo.muzzleVelocityMps, system).toString() : '',
  );
  const [bc, setBc] = useState(ammo?.ballisticCoefficient?.toString() ?? '');
  const [bcModel, setBcModel] = useState<string>(ammo?.bcModel ?? '');
  const [notes, setNotes] = useState(ammo?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showSug, setShowSug] = useState(false);

  const { data: suggestions } = useQuery({
    queryKey: ['ammo-suggest', name],
    queryFn: () => ammoApi.suggest(name),
    enabled: showSug && name.trim().length >= 1 && !ammo,
  });

  const save = useMutation({
    mutationFn: (input: CreateAmmoInput) =>
      ammo ? ammoApi.update(ammo.id, input) : ammoApi.create(input),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to save'),
  });

  const applySuggestion = (s: AmmoSuggestion) => {
    setName(s.name);
    setCaliber(s.caliber);
    setWeight(s.bulletWeightG != null ? weightFromG(s.bulletWeightG, system).toString() : '');
    setVelocity(
      s.muzzleVelocityMps != null ? velocityFromMps(s.muzzleVelocityMps, system).toString() : '',
    );
    setBc(s.ballisticCoefficient?.toString() ?? '');
    setBcModel(s.bcModel ?? '');
    setShowSug(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const w = numOrNull(weight);
    const v = numOrNull(velocity);
    save.mutate({
      name: name.trim(),
      caliber: caliber.trim() || null,
      bulletWeightG: w != null ? weightToG(w, system) : null,
      muzzleVelocityMps: v != null ? velocityToMps(v, system) : null,
      ballisticCoefficient: numOrNull(bc),
      bcModel: bcModel === '' ? null : (bcModel as CreateAmmoInput['bcModel']),
      notes: notes.trim() || null,
    });
  };

  return (
    <Card>
      <h2 className="mb-4 font-medium">{ammo ? 'Edit ammo' : 'New ammo'}</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative">
            <Field label="Name">
              <Input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSug(true);
                }}
                onFocus={() => !ammo && setShowSug(true)}
                placeholder="Start typing to autosuggest…"
              />
            </Field>
            {showSug && suggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                {suggestions.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      {s.name}
                      <span className="text-neutral-400"> · {s.caliber}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Field label="Caliber">
            <Input value={caliber} onChange={(e) => setCaliber(e.target.value)} />
          </Field>
          <Field label={`Bullet weight (${weightUnit(system)})`}>
            <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label={`Muzzle velocity (${velocityUnit(system)})`}>
            <Input
              type="number"
              value={velocity}
              onChange={(e) => setVelocity(e.target.value)}
            />
          </Field>
          <Field label="Ballistic coefficient">
            <Input type="number" step="0.001" value={bc} onChange={(e) => setBc(e.target.value)} />
          </Field>
          <Field label="BC model">
            <Select value={bcModel} onChange={(e) => setBcModel(e.target.value)}>
              <option value="">—</option>
              {BC_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {ammo && <ImageGallery ammo={ammo} />}

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

function ImageGallery({ ammo }: { ammo: Ammo }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });
  const [busy, setBusy] = useState(false);

  const addImg = useMutation({
    mutationFn: (imagePath: string) => ammoApi.addImage(ammo.id, imagePath),
    onSuccess: invalidate,
  });
  const delImg = useMutation({
    mutationFn: (imageId: string) => ammoApi.removeImage(ammo.id, imageId),
    onSuccess: invalidate,
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { imagePath } = await uploadImage(file);
      await addImg.mutateAsync(imagePath);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Images</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {ammo.images.map((img) => (
          <div key={img.id} className="relative">
            <AuthImage filename={img.imagePath} className="h-20 w-20 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => delImg.mutate(img.id)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-xs text-white shadow"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-emerald-500 dark:border-neutral-700">
          {busy ? '…' : '+'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
