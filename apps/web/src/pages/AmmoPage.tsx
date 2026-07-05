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
import { CaliberSelect } from '../components/CaliberSelect';
import { Modal } from '../components/Modal';
import { UrlImageInput } from '../components/UrlImageInput';
import { Button, Field, Input, Select, Textarea } from '../components/ui';

const today = (): string => new Date().toISOString().slice(0, 10);
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function AmmoPage() {
  const [q, setQ] = useState('');
  const { data: ammo, isLoading } = useQuery({
    queryKey: ['ammo', q],
    queryFn: () => ammoApi.list(q || undefined),
  });
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  // Read the live row from the (refetched) list so the modal reflects edits immediately.
  const editingAmmo =
    editingId && editingId !== 'new' ? (ammo?.find((a) => a.id === editingId) ?? null) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ammo</h1>
        <Button onClick={() => setEditingId('new')}>+ New ammo</Button>
      </div>

      <Input
        placeholder="Search by name, caliber, notes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {isLoading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : !ammo || ammo.length === 0 ? (
        <p className="text-neutral-500">No ammo found.</p>
      ) : (
        <div className="space-y-3">
          {ammo.map((a) => (
            <AmmoRow key={a.id} ammo={a} onOpen={() => setEditingId(a.id)} />
          ))}
        </div>
      )}

      {editingId !== null && (
        <Modal
          title={editingAmmo ? editingAmmo.name : 'New ammo'}
          onClose={() => setEditingId(null)}
        >
          <AmmoDetail ammo={editingAmmo} onClose={() => setEditingId(null)} />
        </Modal>
      )}
    </div>
  );
}

function AmmoRow({ ammo, onOpen }: { ammo: Ammo; onOpen: () => void }) {
  const system = useUnitSystem();
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-emerald-500/60 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      {ammo.images[0] ? (
        <AuthImage
          filename={ammo.images[0].imagePath}
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-neutral-200 text-xl dark:bg-neutral-800">
          🧊
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{ammo.name}</h3>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-neutral-500">
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
          {ammo.lastPricePerRound != null && (
            <span>
              {ammo.lastPricePerRound.toFixed(2)} {ammo.priceEntries[0]?.currency}/rd
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-neutral-400">›</span>
    </button>
  );
}

function AmmoDetail({ ammo, onClose }: { ammo: Ammo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const system = useUnitSystem();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });

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
  // Images uploaded before the ammo exists (create mode) are staged, then attached on save.
  const [staged, setStaged] = useState<string[]>([]);

  const { data: suggestions } = useQuery({
    queryKey: ['ammo-suggest', name],
    queryFn: () => ammoApi.suggest(name),
    enabled: showSug && name.trim().length >= 1 && !ammo,
  });

  const save = useMutation({
    mutationFn: async (input: CreateAmmoInput) => {
      if (ammo) return ammoApi.update(ammo.id, input);
      const created = await ammoApi.create(input);
      for (const path of staged) await ammoApi.addImage(created.id, path);
      return created;
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to save'),
  });

  const del = useMutation({
    mutationFn: () => ammoApi.remove(ammo!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
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
    <form onSubmit={submit} className="space-y-5">
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
          <CaliberSelect value={caliber} onChange={setCaliber} />
        </Field>
        <Field label={`Bullet weight (${weightUnit(system)})`}>
          <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label={`Muzzle velocity (${velocityUnit(system)})`}>
          <Input type="number" value={velocity} onChange={(e) => setVelocity(e.target.value)} />
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

      <ImagesEditor ammo={ammo} staged={staged} onStagedChange={setStaged} />

      {ammo && <PriceLog ammo={ammo} />}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : ammo ? 'Save' : 'Create'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {ammo && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${ammo.name}"?`)) del.mutate();
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

/** Works in both modes: server-backed when editing, local staging when creating. */
function ImagesEditor({
  ammo,
  staged,
  onStagedChange,
}: {
  ammo: Ammo | null;
  staged: string[];
  onStagedChange: (paths: string[]) => void;
}) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addImg = useMutation({
    mutationFn: (imagePath: string) => ammoApi.addImage(ammo!.id, imagePath),
    onSuccess: invalidate,
  });
  const delImg = useMutation({
    mutationFn: (imageId: string) => ammoApi.removeImage(ammo!.id, imageId),
    onSuccess: invalidate,
  });

  const items = ammo
    ? ammo.images.map((img) => ({ key: img.id, path: img.imagePath }))
    : staged.map((p) => ({ key: p, path: p }));

  const addPath = async (imagePath: string) => {
    if (ammo) await addImg.mutateAsync(imagePath);
    else onStagedChange([...staged, imagePath]);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { imagePath } = await uploadImage(file);
      await addPath(imagePath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const remove = (key: string) => {
    if (ammo) {
      if (confirm('Delete this image?')) delImg.mutate(key);
    } else {
      onStagedChange(staged.filter((p) => p !== key));
    }
  };

  return (
    <div>
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Images</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {items.map((it) => (
          <div key={it.key} className="relative">
            <AuthImage filename={it.path} zoomable className="h-20 w-20 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => remove(it.key)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-neutral-900 text-xs text-white shadow"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-neutral-300 text-2xl text-neutral-400 hover:border-emerald-500 dark:border-neutral-700">
          {busy ? '…' : '+'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFile}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2">
        <UrlImageInput onAdded={addPath} />
      </div>
    </div>
  );
}

function PriceLog({ ammo }: { ammo: Ammo }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ammo'] });
  const [date, setDate] = useState(today());
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(ammo.priceEntries[0]?.currency ?? 'CZK');
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
    <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
        Price log
        {ammo.roundsPurchased > 0 && (
          <span className="font-normal text-neutral-400"> · {ammo.roundsPurchased} rds bought</span>
        )}
      </span>
      {ammo.priceEntries.length > 0 && (
        <div className="my-2 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {ammo.priceEntries.map((p) => (
                <tr key={p.id} className="text-neutral-600 dark:text-neutral-300">
                  <td className="whitespace-nowrap py-1 pr-3">{p.date.slice(0, 10)}</td>
                  <td className="whitespace-nowrap pr-3">
                    {p.pricePerRound.toFixed(2)} {p.currency}/rd
                  </td>
                  <td className="pr-3">×{p.quantity}</td>
                  <td className="pr-3 text-neutral-400">{p.vendor}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this price entry?')) del.mutate(p.id);
                      }}
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
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <Input
          type="number"
          step="0.01"
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
        <Button type="button" onClick={() => price && add.mutate()} disabled={add.isPending}>
          Add
        </Button>
      </div>
    </div>
  );
}
