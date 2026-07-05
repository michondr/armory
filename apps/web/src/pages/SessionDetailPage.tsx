import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
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

function ValueSelector({
  values,
  selected,
  onSelect,
  counts,
  dark,
}: {
  values: string[];
  selected: string;
  onSelect: (v: string) => void;
  counts?: Record<string, number>;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className={`mr-1 mt-2 text-xs ${dark ? 'text-neutral-300' : 'text-neutral-500'}`}>
        Value:
      </span>
      {values.map((v) => (
        <div key={v} className="flex w-8 flex-col items-center">
          <button
            type="button"
            onClick={() => onSelect(v)}
            className={`h-8 w-8 rounded-full text-sm font-medium transition ${
              selected === v
                ? 'bg-emerald-600 text-white'
                : dark
                  ? 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
                  : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200'
            }`}
          >
            {v}
          </button>
          <span className={`mt-0.5 h-3 text-[10px] leading-3 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {counts?.[v] ? `×${counts[v]}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Marker whose on-screen size stays constant regardless of the zoom scale. */
function Marker({
  shot,
  scale,
  onRemove,
}: {
  shot: PlacedShot;
  scale: number;
  onRemove?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onRemove
          ? (e) => {
              e.stopPropagation();
              onRemove();
            }
          : undefined
      }
      title={onRemove ? 'Tap to remove' : undefined}
      style={{
        left: `${shot.x * 100}%`,
        top: `${shot.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${1 / scale})`,
        transformOrigin: 'center',
      }}
      className={`absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 bg-black/60 text-[10px] font-bold text-white ${
        onRemove ? '' : 'pointer-events-none'
      }`}
    >
      {shot.ringValue ?? shot.zone}
    </button>
  );
}

// Horizontal wheel must travel this many px (accumulated) to advance the value
// one step. Raise to require more movement, lower for a hair trigger.
const VALUE_STEP_THRESHOLD = 130;

// Keyframes for the directional "pop" of the cursor value badge when the
// horizontal wheel advances to the next value.
const POP_KEYFRAMES = `
@keyframes armory-pop-right { 0% { transform: translateX(-14px) scale(.6); opacity: .15 } 55% { transform: translateX(3px) scale(1.1) } 100% { transform: translateX(0) scale(1); opacity: 1 } }
@keyframes armory-pop-left { 0% { transform: translateX(14px) scale(.6); opacity: .15 } 55% { transform: translateX(-3px) scale(1.1) } 100% { transform: translateX(0) scale(1); opacity: 1 } }
`;

/** Zoomable placement surface: tap to place the selected value, tap a marker to remove.
 *  Vertical wheel zooms (handled by the lib); horizontal wheel steps the value. */
function PlaceSurface({
  target,
  isIpsc,
  values,
  selected,
  onSelect,
  shots,
  commit,
  imgClass,
}: {
  target: TargetDto;
  isIpsc: boolean;
  values: string[];
  selected: string;
  onSelect: (v: string) => void;
  shots: PlacedShot[];
  commit: (next: PlacedShot[]) => void;
  imgClass: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const wheelAcc = useRef(0);
  // Only show the cursor value badge with a real pointer (mouse), not on touch.
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches);

  // Horizontal-wheel stepper UI: popKey/popDir replay a directional "pop" each
  // time the value advances; wheelDir/wheelProgress drive a chevron + fill bar
  // showing which way you're scrolling and how close the next step is.
  const [popKey, setPopKey] = useState(0);
  const [popDir, setPopDir] = useState(0);
  const [wheelDir, setWheelDir] = useState<number | null>(null);
  const [wheelProgress, setWheelProgress] = useState(0);
  const popKeyRef = useRef(0);
  const hideDirTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const normFromEvent = (e: React.MouseEvent): { x: number; y: number } | null => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  };

  const addAt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = normFromEvent(e);
    if (!p) return;
    const shot: PlacedShot = isIpsc
      ? { x: p.x, y: p.y, ringValue: null, zone: selected }
      : { x: p.x, y: p.y, ringValue: Number(selected), zone: null };
    commit([...shots, shot]);
  };

  const step = (dir: number): boolean => {
    const idx = values.indexOf(selectedRef.current);
    const n = idx + dir;
    if (n < 0 || n >= values.length) return false;
    const next = values[n]!;
    selectedRef.current = next; // optimistic: chained steps in one event advance
    onSelect(next);
    return true;
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  const scheduleHideDir = () => {
    if (hideDirTimer.current) clearTimeout(hideDirTimer.current);
    hideDirTimer.current = setTimeout(() => {
      setWheelDir(null);
      setWheelProgress(0);
    }, 500);
  };

  // Horizontal wheel (incl. the MX Master thumb wheel) steps the value; vertical is
  // left to the zoom library. Bound natively + non-passive because the zoom lib can
  // swallow React's onWheel before it fires. Reversing direction resets the
  // accumulator so the indicator reflips instead of instantly popping the other way.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const lines = e.deltaMode === 1;
      const dx = lines ? e.deltaX * 16 : e.deltaX;
      const dy = lines ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(dx) <= Math.abs(dy)) return; // vertical → let the lib zoom
      e.preventDefault();
      e.stopPropagation();
      const dir = dx > 0 ? 1 : -1;
      if (Math.sign(wheelAcc.current) && Math.sign(wheelAcc.current) !== dir) {
        wheelAcc.current = 0; // reversed → start the fill fresh from this side
      }
      wheelAcc.current += dx;
      setWheelDir(dir);
      scheduleHideDir();
      while (Math.abs(wheelAcc.current) >= VALUE_STEP_THRESHOLD) {
        const s = Math.sign(wheelAcc.current);
        if (stepRef.current(s > 0 ? 1 : -1)) {
          popKeyRef.current += 1;
          setPopKey(popKeyRef.current);
          setPopDir(s > 0 ? 1 : -1);
        }
        wheelAcc.current -= s * VALUE_STEP_THRESHOLD;
      }
      setWheelProgress(Math.min(1, Math.abs(wheelAcc.current) / VALUE_STEP_THRESHOLD));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (hideDirTimer.current) clearTimeout(hideDirTimer.current);
    };
  }, []);

  const surface = (
    <div
      ref={wrapRef}
      onClick={addAt}
      onMouseMove={(e) => setCursor(normFromEvent(e))}
      onMouseLeave={() => setCursor(null)}
      className="relative inline-block cursor-crosshair select-none"
    >
      <style>{POP_KEYFRAMES}</style>
      <AuthImage filename={target.imagePath!} className={imgClass} />
      {shots.map((s, i) => (
        <Marker
          key={i}
          shot={s}
          scale={scale}
          onRemove={() => commit(shots.filter((_, idx) => idx !== i))}
        />
      ))}
      {finePointer && cursor && (
        <div
          style={{
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            transform: `translate(12px, -140%) scale(${1 / scale})`,
            transformOrigin: 'left bottom',
          }}
          className="pointer-events-none absolute"
        >
          <div
            key={popKey}
            className="flex items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white shadow"
            style={
              popKey === 0
                ? undefined
                : {
                    animation: `${popDir === 1 ? 'armory-pop-right' : 'armory-pop-left'} 220ms cubic-bezier(.2,.8,.2,1)`,
                  }
            }
          >
            {wheelDir === -1 && <span className="text-emerald-200">‹</span>}
            <span>{selected}</span>
            {wheelDir === 1 && <span className="text-emerald-200">›</span>}
          </div>
          {wheelDir !== null && (
            <div
              className={`mt-0.5 flex h-0.5 w-12 overflow-hidden rounded-full bg-white/25 ${
                wheelDir === -1 ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className="h-full rounded-full bg-emerald-300"
                style={{ width: `${Math.round(wheelProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <TransformWrapper
      minScale={1}
      maxScale={12}
      doubleClick={{ disabled: true }}
      // smooth=true (lib default) makes the zoom step = smoothStep * |deltaY|,
      // so it scales with wheel velocity — trackpads / MX Master freespin stay
      // proportional instead of detonating to maxScale. ~0.04 ≈ 400% per notch
      // on a discrete mouse. Bump up to zoom faster, down for finer control.
      wheel={{ smoothStep: 0.04 }}
      onTransformed={(_ref, state) => setScale(state.scale)}
      centerOnInit
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div
            className="absolute right-3 top-3 z-10 flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {[
              ['+', () => zoomIn()],
              ['−', () => zoomOut()],
              ['⟲', () => resetTransform()],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                type="button"
                onClick={fn as () => void}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg font-bold text-neutral-800 shadow"
              >
                {label as string}
              </button>
            ))}
          </div>
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {surface}
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}

/** Fullscreen overlay for precise placement; Back / Esc close it. */
function FullscreenPlacer({
  onClose,
  header,
  children,
}: {
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    window.history.pushState({ armoryFull: true }, '');
    let byBack = false;
    const onPop = () => {
      byBack = true;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      const state = window.history.state as { armoryFull?: boolean } | null;
      if (!byBack && state?.armoryFull) window.history.back();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 overflow-x-auto">{header}</div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-3xl leading-none text-white/80 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden" onClick={onClose}>
        {children}
      </div>
    </div>
  );
}

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
  const [full, setFull] = useState(false);

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

  const total = shots.reduce((sum, s) => sum + (s.ringValue ?? (s.zone ? zonePoints(s.zone) : 0)), 0);
  const counts: Record<string, number> = {};
  for (const s of shots) {
    const key = isIpsc ? (s.zone ?? '') : s.ringValue != null ? String(s.ringValue) : '';
    if (key) counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-neutral-500">
        {shots.length} shots · total {total} ·{' '}
        <button
          type="button"
          onClick={() => setFull(true)}
          className="font-medium text-emerald-600 hover:underline"
        >
          ⛶ Zoom &amp; score
        </button>
      </p>
      {/* Read-only preview; tap to open the zoomable scoring view. */}
      <div
        onClick={() => setFull(true)}
        className="relative inline-block max-w-full cursor-zoom-in"
      >
        <AuthImage
          filename={target.imagePath!}
          className="block max-h-[45vh] w-auto max-w-full rounded-lg"
        />
        {shots.map((s, i) => (
          <Marker key={i} shot={s} scale={1} />
        ))}
      </div>
      {full && (
        <FullscreenPlacer
          onClose={() => setFull(false)}
          header={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <ValueSelector
                values={values}
                selected={selected}
                onSelect={setSelected}
                counts={counts}
                dark
              />
              <span className="text-sm font-medium text-white">
                {shots.length} shots · {total} pts
              </span>
            </div>
          }
        >
          <PlaceSurface
            target={target}
            isIpsc={isIpsc}
            values={values}
            selected={selected}
            onSelect={setSelected}
            shots={shots}
            commit={commit}
            imgClass="block max-h-[82vh] max-w-[92vw]"
          />
        </FullscreenPlacer>
      )}
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
  const [maxScore, setMaxScore] = useState(target.maxScorePerShot?.toString() ?? '');
  const [scoring, setScoring] = useState<string>(target.scoringSystem);
  const [imagePath, setImagePath] = useState<string | null>(target.imagePath);

  const save = useMutation({
    mutationFn: () =>
      sessionsApi.updateTarget(sessionId, setId, target.id, {
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
      <ImageField value={imagePath} onChange={setImagePath} placeholder="🎯" allowUrl={false} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scoring">
          <Select value={scoring} onChange={(e) => setScoring(e.target.value)}>
            {SCORING_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {scoring === 'RINGS' && (
          <Field label="Max score/shot">
            <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </Field>
        )}
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
  const [maxScore, setMaxScore] = useState('10');
  const [scoring, setScoring] = useState('RINGS');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      sessionsApi.addTarget(sessionId, setId, {
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
      <ImageField value={imagePath} onChange={setImagePath} placeholder="🎯" allowUrl={false} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scoring">
          <Select value={scoring} onChange={(e) => setScoring(e.target.value)}>
            {SCORING_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {scoring === 'RINGS' && (
          <Field label="Max score/shot">
            <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </Field>
        )}
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
