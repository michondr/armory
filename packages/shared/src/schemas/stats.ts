export interface ShotStats {
  count: number;
  total: number;
  /** Mean ring value per shot. */
  average: number | null;
  /** Mean of the best 90% of shots (drops the worst 10%). */
  best90: number | null;
  /** Mean of the worst 10% of shots. */
  worst10: number | null;
  /** Extreme spread (max pairwise distance) when shot positions are known, else null. */
  groupingMm: number | null;
}

export interface Point {
  x: number;
  y: number;
}

const mean = (arr: number[]): number | null =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

/**
 * Compute scoring stats over a set of per-shot ring values.
 * - `average`  = mean of all shots
 * - `best90`   = mean of the best 90% (worst 10% dropped)
 * - `worst10`  = mean of the worst 10%
 * The 10% bucket is at least one shot (`round(n * 0.1)`, floored at 1).
 */
export function computeShotStats(scores: number[], positions?: Point[]): ShotStats {
  const count = scores.length;
  if (count === 0) {
    return { count: 0, total: 0, average: null, best90: null, worst10: null, groupingMm: null };
  }
  const total = scores.reduce((a, b) => a + b, 0);
  const sorted = [...scores].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(count * 0.1));
  const worst = sorted.slice(0, k);
  const best = sorted.slice(k);
  return {
    count,
    total,
    average: total / count,
    best90: mean(best.length ? best : sorted),
    worst10: mean(worst),
    groupingMm: positions && positions.length >= 2 ? extremeSpread(positions) : null,
  };
}

/** Largest distance between any two points (extreme spread). */
export function extremeSpread(points: Point[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > max) max = d;
    }
  }
  return max;
}
