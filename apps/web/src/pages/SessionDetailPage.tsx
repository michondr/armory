import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  parseRingValues,
  parseZones,
  SCORING_SYSTEMS,
  zonePoints,
  type CreateTargetInput,
  type SessionDetail,
  type SetDto,
  type TargetDto,
} from '@armory/shared';
import { sessionsApi } from '../lib/api';
import { AuthImage } from '../components/AuthImage';
import { ImageField } from '../components/ImageField';
import { StatChips } from '../components/StatChips';
import { Button, Card, Field, Input, Select } from '../components/ui';

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => sessionsApi.get(id),
  });

  const del = useMutation({
    mutationFn: () => sessionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      navigate('/sessions');
    },
  });

  if (isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (!session) return <p className="text-neutral-500">Session not found.</p>;

  return (
    <div className="space-y-6">
      <Link to="/sessions" className="text-sm text-neutral-500 hover:underline">
        ← All sessions
      </Link>

      <Card className="flex flex-wrap items-start gap-4">
        {session.gun.imagePath ? (
          <AuthImage
            filename={session.gun.imagePath}
            zoomable
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-neutral-200 text-2xl dark:bg-neutral-800">
            🔫
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{session.gun.name}</h1>
          <p className="text-sm text-neutral-500">
            {new Date(session.startedAt).toLocaleString()}
            {session.locationName && ` · ${session.locationName}`}
            {' · '}
            {session.discipline === 'LONG' ? 'Long range' : 'Short range'}
            {session.ammo && ` · ${session.ammo.name}`}
          </p>
          <div className="mt-2">
            <StatChips stats={session.stats} />
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm('Delete this session?')) del.mutate();
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
        >
          Delete
        </button>
      </Card>

      {session.sets.map((set, i) => (
        <SetBlock key={set.id} sessionId={id} set={set} index={i} />
      ))}

      <AddSetForm sessionId={id} />
    </div>
  );
}

function useSessionUpdate(sessionId: string) {
  const qc = useQueryClient();
  return (data: SessionDetail) => qc.setQueryData(['session', sessionId], data);
}

function SetBlock({ sessionId, set, index }: { sessionId: string; set: SetDto; index: number }) {
  const apply = useSessionUpdate(sessionId);
  const removeSet = useMutation({
    mutationFn: () => sessionsApi.removeSet(sessionId, set.id),
    onSuccess: apply,
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">
            Set {index + 1}
            {set.distanceM != null && (
              <span className="text-neutral-400"> · {set.distanceM} m</span>
            )}
          </h2>
          <StatChips stats={set.stats} />
        </div>
        <button
          onClick={() => {
            if (confirm('Remove this set and all its targets?')) removeSet.mutate();
          }}
          className="text-sm text-neutral-400 hover:text-red-500"
        >
          Remove set
        </button>
      </div>

      <div className="space-y-3">
        {set.targets.map((t, i) => (
          <TargetBlock key={t.id} sessionId={sessionId} setId={set.id} target={t} index={i} />
        ))}
      </div>

      <AddTargetForm sessionId={sessionId} setId={set.id} />
    </Card>
  );
}

function TargetBlock({
  sessionId,
  setId,
  target,
  index,
}: {
  sessionId: string;
  setId: string;
  target: TargetDto;
  index: number;
}) {
  const apply = useSessionUpdate(sessionId);
  const [editing, setEditing] = useState(false);
  const removeTarget = useMutation({
    mutationFn: () => sessionsApi.removeTarget(sessionId, setId, target.id),
    onSuccess: apply,
  });

  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        {target.imagePath ? (
          <AuthImage
            filename={target.imagePath}
            zoomable
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-neutral-200 text-xl dark:bg-neutral-800">
            🎯
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Target {index + 1}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing((v) => !v)}
                className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                {editing ? 'Close' : 'Edit'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this target?')) removeTarget.mutate();
                }}
                className="text-xs text-neutral-400 hover:text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            {target.scoringSystem}
            {target.maxScorePerShot != null && ` · max ${target.maxScorePerShot}/shot`}
            {target.shotCount ? ` · ${target.shotCount} shots` : ''}
            {target.totalScore != null && ` · total ${target.totalScore}`}
          </p>
          <div className="mt-1">
            <StatChips stats={target.stats} />
          </div>
        </div>
      </div>

      {editing ? (
        <TargetEditForm
          sessionId={sessionId}
          setId={setId}
          target={target}
          onDone={() => setEditing(false)}
        />
      ) : target.imagePath ? (
        <HolePlacer sessionId={sessionId} setId={setId} target={target} />
      ) : (
        <TargetScorer sessionId={sessionId} setId={setId} target={target} />
      )}
    </div>
  );
}

type PlacedShot = { x: number; y: number; ringValue: number | null; zone: string | null };

/** Tap-to-place scoring: pick a value, then tap the photo where each hole is. */
function HolePlacer({
  sessionId,
  setId,
  target,
}: {
  sessionId: string;
  setId: string;
  target: TargetDto;
}) {
  const apply = useSessionUpdate(sessionId);
  const isIpsc = target.scoringSystem === 'IPSC';
  const max = target.maxScorePerShot ?? 10;
  const values: string[] = isIpsc
    ? ['A', 'C', 'D', 'M']
    : Array.from({ length: max + 1 }, (_, i) => String(max - i));
  const [selected, setSelected] = useState(values[0]!);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Local list is authoritative (avoids races between quick taps and the server).
  const [shots, setShots] = useState<PlacedShot[]>(() =>
    target.shots
      .filter((s) => s.x != null && s.y != null)
      .map((s) => ({ x: s.x as number, y: s.y as number, ringValue: s.ringValue, zone: s.zone })),
  );

  const persist = useMutation({
    mutationFn: (next: PlacedShot[]) => sessionsApi.setShots(sessionId, setId, target.id, { shots: next }),
    onSuccess: apply,
  });
  const commit = (next: PlacedShot[]) => {
    setShots(next);
    persist.mutate(next);
  };

  const addAt = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const shot: PlacedShot = isIpsc
      ? { x, y, ringValue: null, zone: selected }
      : { x, y, ringValue: Number(selected), zone: null };
    commit([...shots, shot]);
  };

  const total = shots.reduce(
    (sum, s) => sum + (s.ringValue ?? (s.zone ? zonePoints(s.zone) : 0)),
    0,
  );

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-neutral-500">Value:</span>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSelected(v)}
            className={`h-8 w-8 rounded-full text-sm font-medium transition ${
              selected === v
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-500">
        Tap the photo to place a <b>{selected}</b>. Tap a marker to remove it. · {shots.length} shots
        · total {total}
      </p>
      <div
        ref={wrapRef}
        onClick={addAt}
        className="relative inline-block max-w-full cursor-crosshair select-none"
      >
        <AuthImage
          filename={target.imagePath!}
          className="block max-h-[70vh] w-auto max-w-full rounded-lg"
        />
        {shots.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit(shots.filter((_, idx) => idx !== i));
            }}
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
            title="Tap to remove"
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-500 bg-black/60 text-[10px] font-bold text-white"
          >
            {s.ringValue ?? s.zone}
          </button>
        ))}
      </div>
    </div>
  );
}

function TargetEditForm({
  sessionId,
  setId,
  target,
  onDone,
}: {
  sessionId: string;
  setId: string;
  target: TargetDto;
  onDone: () => void;
}) {
  const apply = useSessionUpdate(sessionId);
  const [shotCount, setShotCount] = useState(target.shotCount.toString());
  const [maxScore, setMaxScore] = useState(target.maxScorePerShot?.toString() ?? '');
  const [scoring, setScoring] = useState<string>(target.scoringSystem);
  const [imagePath, setImagePath] = useState<string | null>(target.imagePath);

  const save = useMutation({
    mutationFn: () =>
      sessionsApi.updateTarget(sessionId, setId, target.id, {
        shotCount: Number(shotCount || '0'),
        maxScorePerShot: maxScore ? Number(maxScore) : null,
        scoringSystem: scoring as CreateTargetInput['scoringSystem'],
        imagePath,
      }),
    onSuccess: (data) => {
      apply(data);
      onDone();
    },
  });

  return (
    <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <ImageField value={imagePath} onChange={setImagePath} placeholder="🎯" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Shots">
          <Input type="number" value={shotCount} onChange={(e) => setShotCount(e.target.value)} />
        </Field>
        <Field label="Max score/shot">
          <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </Field>
        <Field label="Scoring">
          <Select value={scoring} onChange={(e) => setScoring(e.target.value)}>
            {SCORING_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save target'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TargetScorer({
  sessionId,
  setId,
  target,
}: {
  sessionId: string;
  setId: string;
  target: TargetDto;
}) {
  const apply = useSessionUpdate(sessionId);
  const isIpsc = target.scoringSystem === 'IPSC';

  const initial = isIpsc
    ? target.shots
        .map((s) => s.zone)
        .filter((z): z is string => !!z)
        .join(' ')
    : target.shots
        .map((s) => s.ringValue)
        .filter((v): v is number => v != null)
        .join(' ');
  const [text, setText] = useState(initial);

  const zones = isIpsc ? parseZones(text) : [];
  const ringValues = isIpsc ? [] : parseRingValues(text);

  const save = useMutation({
    mutationFn: () =>
      sessionsApi.setShots(sessionId, setId, target.id, isIpsc ? { zones } : { ringValues }),
    onSuccess: apply,
  });

  const summary = isIpsc
    ? `${zones.length} hits · ${zones.reduce((s, z) => s + zonePoints(z), 0)} pts`
    : (() => {
        const sum = ringValues.reduce((a, b) => a + b, 0);
        const avg = ringValues.length ? (sum / ringValues.length).toFixed(2) : '–';
        return `${ringValues.length} shots · sum ${sum} · avg ${avg}`;
      })();

  return (
    <div className="mt-2 space-y-1">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          isIpsc ? 'Zones, e.g. A A C M or 2xA 1xC 1xM' : 'Ring values, e.g. 10 10 9 or 3x10 2x9'
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>{summary}</span>
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save score'}
        </Button>
      </div>
    </div>
  );
}

function AddSetForm({ sessionId }: { sessionId: string }) {
  const apply = useSessionUpdate(sessionId);
  const [distance, setDistance] = useState('');
  const add = useMutation({
    mutationFn: () =>
      sessionsApi.addSet(sessionId, { distanceM: distance ? Number(distance) : null }),
    onSuccess: (data) => {
      setDistance('');
      apply(data);
    },
  });

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        add.mutate();
      }}
      className="flex items-end gap-2"
    >
      <Field label="Add set — distance (m, optional)">
        <Input
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="w-48"
        />
      </Field>
      <Button type="submit" disabled={add.isPending}>
        + Add set
      </Button>
    </form>
  );
}

function AddTargetForm({ sessionId, setId }: { sessionId: string; setId: string }) {
  const apply = useSessionUpdate(sessionId);
  const [shotCount, setShotCount] = useState('10');
  const [maxScore, setMaxScore] = useState('10');
  const [scoring, setScoring] = useState('RINGS');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      sessionsApi.addTarget(sessionId, setId, {
        shotCount: Number(shotCount || '0'),
        maxScorePerShot: maxScore ? Number(maxScore) : null,
        scoringSystem: scoring as CreateTargetInput['scoringSystem'],
        imagePath,
      }),
    onSuccess: (data) => {
      setImagePath(null);
      setOpen(false);
      apply(data);
    },
  });

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        + Add target
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
      <ImageField value={imagePath} onChange={setImagePath} placeholder="🎯" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Shots">
          <Input type="number" value={shotCount} onChange={(e) => setShotCount(e.target.value)} />
        </Field>
        <Field label="Max score/shot">
          <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </Field>
        <Field label="Scoring">
          <Select value={scoring} onChange={(e) => setScoring(e.target.value)}>
            {SCORING_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => add.mutate()} disabled={add.isPending}>
          Add target
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
