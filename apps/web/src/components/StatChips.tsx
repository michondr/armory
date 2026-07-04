import type { ShotStats } from '@armory/shared';

const fmt = (n: number | null, dp = 1): string => (n == null ? '–' : n.toFixed(dp));

/** Compact readout of scoring stats (average, best-90%, worst-10%, grouping). */
export function StatChips({ stats }: { stats: ShotStats }) {
  if (stats.count === 0) {
    return <span className="text-sm text-neutral-400">No shots scored</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
      <span>{stats.count} shots</span>
      <span>
        avg{' '}
        <b className="text-neutral-700 dark:text-neutral-200">{fmt(stats.average)}</b>
      </span>
      <span>top 90% {fmt(stats.best90)}</span>
      <span>low 10% {fmt(stats.worst10)}</span>
      {stats.groupingMm != null && <span>group {fmt(stats.groupingMm, 0)} mm</span>}
    </div>
  );
}
