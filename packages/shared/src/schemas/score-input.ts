/**
 * Split a score-entry string into tokens, expanding "NxTOKEN" repeats.
 * Separators are whitespace and/or commas. The multiplier must be written
 * without spaces ("3x10", not "3 x 10"). Examples:
 *   "10 10 9"   -> ["10","10","9"]
 *   "3x10 2x9"  -> ["10","10","10","9","9"]
 *   "2xA B"     -> ["A","A","B"]
 *   "2xA 1xB"   -> ["A","A","B"]
 */
export function expandScoreTokens(input: string): string[] {
  const out: string[] = [];
  for (const part of input.trim().split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d+)x(.+)$/i.exec(part);
    if (m) {
      const count = Number(m[1]);
      for (let i = 0; i < count; i++) out.push(m[2]!);
    } else {
      out.push(part);
    }
  }
  return out;
}

/** Parse ring/point values (numbers), expanding repeats; non-numeric tokens are ignored. */
export function parseRingValues(input: string): number[] {
  return expandScoreTokens(input)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
}

/** Parse IPSC zone letters (uppercased), expanding repeats; non-letter tokens are ignored. */
export function parseZones(input: string): string[] {
  return expandScoreTokens(input)
    .map((t) => t.toUpperCase())
    .filter((t) => /^[A-Z]+$/.test(t));
}

/**
 * IPSC zone point values: A(lpha), C(harlie), D(elta), M(iss). Miss is -10.
 * Minor power factor defaults; per-division/major scoring comes with Phase 5.
 */
export const IPSC_ZONE_POINTS: Record<string, number> = {
  A: 5,
  C: 3,
  D: 1,
  M: -10,
  NS: -10, // no-shoot penalty
};

export function zonePoints(zone: string): number {
  return IPSC_ZONE_POINTS[zone.toUpperCase()] ?? 0;
}
