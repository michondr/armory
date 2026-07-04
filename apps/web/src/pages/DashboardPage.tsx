import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Gun, SessionListItem } from '@armory/shared';
import { gunsApi, sessionsApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AuthImage } from '../components/AuthImage';
import { StatChips } from '../components/StatChips';
import { Card } from '../components/ui';

const relative = (iso: string | null): string => {
  if (!iso) return 'never shot';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export function DashboardPage() {
  const { auth } = useAuth();
  const { data: guns } = useQuery({ queryKey: ['guns'], queryFn: gunsApi.list });
  const [selectedGunId, setSelectedGunId] = useState<string | null>(null);
  const { data: sessions } = useQuery({
    queryKey: ['sessions', selectedGunId],
    queryFn: () => sessionsApi.list(selectedGunId ?? undefined),
  });

  const selectedGun = guns?.find((g) => g.id === selectedGunId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-neutral-500">
          Welcome back, {auth?.user.displayName ?? auth?.user.email}.
        </p>
      </div>

      {guns && guns.length > 0 && (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {guns.map((gun) => (
            <GunTile
              key={gun.id}
              gun={gun}
              selected={gun.id === selectedGunId}
              onClick={() => setSelectedGunId((cur) => (cur === gun.id ? null : gun.id))}
            />
          ))}
        </div>
      )}

      {selectedGun && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{selectedGun.name}</h2>
            <button
              onClick={() => setSelectedGunId(null)}
              className="text-sm text-neutral-500 hover:underline"
            >
              Clear filter
            </button>
          </div>
          <GunSummary gun={selectedGun} sessions={sessions ?? []} />
        </Card>
      )}

      <div>
        <h2 className="mb-3 font-medium">
          {selectedGun ? `Sessions with ${selectedGun.name}` : 'Recent sessions'}
        </h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-neutral-500">
            No sessions yet.{' '}
            <Link to="/sessions" className="text-emerald-600 hover:underline">
              Start one
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GunTile({
  gun,
  selected,
  onClick,
}: {
  gun: Gun;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-40 shrink-0 rounded-2xl border p-3 text-left transition ${
        selected
          ? 'border-emerald-500 bg-emerald-500/5'
          : 'border-neutral-200 bg-white hover:border-emerald-500/60 dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      {gun.imagePath ? (
        <AuthImage filename={gun.imagePath} className="mb-2 h-24 w-full rounded-lg object-cover" />
      ) : (
        <div className="mb-2 grid h-24 w-full place-items-center rounded-lg bg-neutral-200 text-3xl dark:bg-neutral-800">
          🔫
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-medium">{gun.name}</span>
        {gun.cleaningDue && <span title="Cleaning due">🧽</span>}
      </div>
      <p className="text-xs text-neutral-500">{gun.roundsFired} rds · {relative(gun.lastShotAt)}</p>
    </button>
  );
}

function GunSummary({ gun, sessions }: { gun: Gun; sessions: SessionListItem[] }) {
  const shots = sessions.reduce((n, s) => n + s.stats.count, 0);
  const total = sessions.reduce((n, s) => n + s.stats.total, 0);
  const avg = shots > 0 ? (total / shots).toFixed(2) : '–';

  return (
    <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <Stat label="Rounds fired" value={gun.roundsFired.toString()} />
      <Stat label="Sessions" value={sessions.length.toString()} />
      <Stat label="Shots scored" value={shots.toString()} />
      <Stat label="Avg score" value={avg} />
      {gun.cleaningIntervalRounds != null && (
        <Stat
          label="Since cleaning"
          value={`${gun.roundsSinceCleaning}/${gun.cleaningIntervalRounds}`}
        />
      )}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{value}</dd>
    </div>
  );
}

function SessionRow({ session }: { session: SessionListItem }) {
  return (
    <Link
      to={`/sessions/${session.id}`}
      className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-500/60 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
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
        </div>
        <StatChips stats={session.stats} />
      </div>
      <span className="shrink-0 text-neutral-400">›</span>
    </Link>
  );
}
