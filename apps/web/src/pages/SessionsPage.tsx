import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DISCIPLINES, type CreateSessionInput, type SessionListItem } from '@armory/shared';
import { ammoApi, ApiError, gunsApi, sessionsApi } from '../lib/api';
import { AuthImage } from '../components/AuthImage';
import { Modal } from '../components/Modal';
import { StatChips } from '../components/StatChips';
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui';

const localNow = (): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function SessionsPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.list(),
  });
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sessions</h1>
        <Button onClick={() => setCreating(true)}>+ New session</Button>
      </div>

      {isLoading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-neutral-500">No sessions yet. Start one after a range trip.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New session" onClose={() => setCreating(false)}>
          <SessionCreateForm
            locations={distinctLocations(sessions)}
            onClose={() => setCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: SessionListItem }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/sessions/${session.id}`)}
      className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-emerald-500/60 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      {session.gun.imagePath ? (
        <AuthImage
          filename={session.gun.imagePath}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-neutral-200 text-lg dark:bg-neutral-800">
          🔫
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-medium">{new Date(session.startedAt).toLocaleDateString()}</span>
          <span className="text-sm text-neutral-500">{session.gun.name}</span>
          {session.locationName && (
            <span className="text-sm text-neutral-400">· {session.locationName}</span>
          )}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
            {session.discipline === 'LONG' ? 'Long range' : 'Short range'}
          </span>
        </div>
        <div className="mt-1">
          <StatChips stats={session.stats} />
        </div>
      </div>
      <span className="shrink-0 text-neutral-400">›</span>
    </button>
  );
}

function distinctLocations(sessions: SessionListItem[] | undefined): string[] {
  const set = new Set<string>();
  for (const s of sessions ?? []) if (s.locationName) set.add(s.locationName);
  return [...set];
}

function SessionCreateForm({
  locations,
  onClose,
}: {
  locations: string[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data: guns } = useQuery({ queryKey: ['guns'], queryFn: gunsApi.list });
  const { data: ammo } = useQuery({ queryKey: ['ammo', ''], queryFn: () => ammoApi.list() });

  const [gunId, setGunId] = useState('');
  const [ammoId, setAmmoId] = useState('');
  const [startedAt, setStartedAt] = useState(localNow());
  const [locationName, setLocationName] = useState('');
  const [discipline, setDiscipline] = useState('SHORT');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (input: CreateSessionInput) => sessionsApi.create(input),
    onSuccess: (session) => {
      onClose();
      navigate(`/sessions/${session.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed to create session'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!gunId) {
      setError('Pick a gun');
      return;
    }
    create.mutate({
      gunId,
      ammoId: ammoId || null,
      startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
      locationName: locationName.trim() || null,
      discipline: discipline as CreateSessionInput['discipline'],
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gun">
          <Select value={gunId} onChange={(e) => setGunId(e.target.value)} required>
            <option value="">Select a gun…</option>
            {(guns ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ammo (optional)">
          <Select value={ammoId} onChange={(e) => setAmmoId(e.target.value)}>
            <option value="">—</option>
            {(ammo ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="When">
          <Input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </Field>
        <Field label="Where">
          <Input
            list="known-locations"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Range name"
          />
          <datalist id="known-locations">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field label="Type">
          <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            {DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {d === 'LONG' ? 'Long range (scope)' : 'Short range'}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create & open'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
