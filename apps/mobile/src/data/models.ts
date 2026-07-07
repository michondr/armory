import { computeShotStats, zonePoints, type ShotStats } from '@armory/shared';
import { getAll, getById, getWhere, type Row } from '../db/repo';

// Typed views over the local SQLite rows. Rows already have the right primitive
// types (SQLite returns numbers/text/null), so these are mostly light casts plus
// a few derived values (stats, round counts).

export interface Gun {
  id: string;
  name: string;
  caliber: string | null;
  imagePath: string | null;
  notes: string | null;
  initialRoundCount: number;
  cleaningIntervalRounds: number | null;
  lastCleanedAtRound: number;
}

export interface Ammo {
  id: string;
  name: string;
  caliber: string | null;
  bulletWeightG: number | null;
  muzzleVelocityMps: number | null;
  ballisticCoefficient: number | null;
  bcModel: 'G1' | 'G7' | null;
  notes: string | null;
}

export interface AmmoImage {
  id: string;
  ammoId: string;
  imagePath: string | null;
}

export interface ScopeProfile {
  id: string;
  gunId: string;
  name: string;
  clickValue: number;
  angularUnit: 'MRAD' | 'MOA';
  zeroRangeM: number;
  sightHeightMm: number;
  notes: string | null;
}

export interface SessionRow {
  id: string;
  gunId: string;
  ammoId: string | null;
  startedAt: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  discipline: 'SHORT' | 'LONG';
  notes: string | null;
}

export interface ShotRow {
  id: string;
  targetId: string;
  index: number;
  ringValue: number | null;
  x: number | null;
  y: number | null;
  zone: string | null;
  source: 'AI' | 'MANUAL';
}

export interface TargetRow {
  id: string;
  setId: string;
  imagePath: string | null;
  shotCount: number;
  scoringSystem: 'RINGS' | 'IPSC' | 'GROUP';
  maxScorePerShot: number | null;
  status: string;
  totalScore: number | null;
  notes: string | null;
}

export interface SetRow {
  id: string;
  sessionId: string;
  order: number;
  distanceM: number | null;
  ipscTimeSeconds: number | null;
  notes: string | null;
}

const asStr = (v: unknown): string => String(v ?? '');
const asNum = (v: unknown): number => (v == null ? 0 : Number(v));
const asNumOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const asStrOrNull = (v: unknown): string | null => (v == null ? null : String(v));

export const toGun = (r: Row): Gun => ({
  id: asStr(r.id),
  name: asStr(r.name),
  caliber: asStrOrNull(r.caliber),
  imagePath: asStrOrNull(r.imagePath),
  notes: asStrOrNull(r.notes),
  initialRoundCount: asNum(r.initialRoundCount),
  cleaningIntervalRounds: asNumOrNull(r.cleaningIntervalRounds),
  lastCleanedAtRound: asNum(r.lastCleanedAtRound),
});

export const toAmmo = (r: Row): Ammo => ({
  id: asStr(r.id),
  name: asStr(r.name),
  caliber: asStrOrNull(r.caliber),
  bulletWeightG: asNumOrNull(r.bulletWeightG),
  muzzleVelocityMps: asNumOrNull(r.muzzleVelocityMps),
  ballisticCoefficient: asNumOrNull(r.ballisticCoefficient),
  bcModel: asStrOrNull(r.bcModel) as 'G1' | 'G7' | null,
  notes: asStrOrNull(r.notes),
});

export const toAmmoImage = (r: Row): AmmoImage => ({
  id: asStr(r.id),
  ammoId: asStr(r.ammoId),
  imagePath: asStrOrNull(r.imagePath),
});

export const toScopeProfile = (r: Row): ScopeProfile => ({
  id: asStr(r.id),
  gunId: asStr(r.gunId),
  name: asStr(r.name),
  clickValue: asNum(r.clickValue),
  angularUnit: (asStrOrNull(r.angularUnit) as 'MRAD' | 'MOA' | null) ?? 'MRAD',
  zeroRangeM: asNum(r.zeroRangeM),
  sightHeightMm: asNum(r.sightHeightMm),
  notes: asStrOrNull(r.notes),
});

export const toSession = (r: Row): SessionRow => ({
  id: asStr(r.id),
  gunId: asStr(r.gunId),
  ammoId: asStrOrNull(r.ammoId),
  startedAt: asStr(r.startedAt),
  locationName: asStrOrNull(r.locationName),
  latitude: asNumOrNull(r.latitude),
  longitude: asNumOrNull(r.longitude),
  discipline: (asStrOrNull(r.discipline) as 'SHORT' | 'LONG' | null) ?? 'SHORT',
  notes: asStrOrNull(r.notes),
});

export const toShot = (r: Row): ShotRow => ({
  id: asStr(r.id),
  targetId: asStr(r.targetId),
  index: asNum(r.index),
  ringValue: asNumOrNull(r.ringValue),
  x: asNumOrNull(r.x),
  y: asNumOrNull(r.y),
  zone: asStrOrNull(r.zone),
  source: (asStrOrNull(r.source) as 'AI' | 'MANUAL' | null) ?? 'MANUAL',
});

export const toTarget = (r: Row): TargetRow => ({
  id: asStr(r.id),
  setId: asStr(r.setId),
  imagePath: asStrOrNull(r.imagePath),
  shotCount: asNum(r.shotCount),
  scoringSystem: (asStrOrNull(r.scoringSystem) as TargetRow['scoringSystem']) ?? 'RINGS',
  maxScorePerShot: asNumOrNull(r.maxScorePerShot),
  status: asStr(r.status) || 'PENDING',
  totalScore: asNumOrNull(r.totalScore),
  notes: asStrOrNull(r.notes),
});

export const toSet = (r: Row): SetRow => ({
  id: asStr(r.id),
  sessionId: asStr(r.sessionId),
  order: asNum(r.order),
  distanceM: asNumOrNull(r.distanceM),
  ipscTimeSeconds: asNumOrNull(r.ipscTimeSeconds),
  notes: asStrOrNull(r.notes),
});

// ---- loaders ----

export const loadGuns = async (): Promise<Gun[]> => (await getAll('guns')).map(toGun);
export const loadAmmo = async (): Promise<Ammo[]> => (await getAll('ammo')).map(toAmmo);
export const ammoImagesForAmmo = async (ammoId: string): Promise<AmmoImage[]> =>
  (await getWhere('ammoImages', 'ammoId', ammoId)).map(toAmmoImage);
export const loadScopeProfiles = async (): Promise<ScopeProfile[]> =>
  (await getAll('scopeProfiles')).map(toScopeProfile);
export const loadSessions = async (): Promise<SessionRow[]> =>
  (await getAll('sessions')).map(toSession).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const loadGun = async (id: string): Promise<Gun | null> => {
  const r = await getById('guns', id);
  return r ? toGun(r) : null;
};

export const loadCartridges = async (): Promise<string[]> =>
  (await getAll('cartridges')).map((r) => asStr(r.name)).sort();

export const scopeProfilesForGun = async (gunId: string): Promise<ScopeProfile[]> =>
  (await getWhere('scopeProfiles', 'gunId', gunId)).map(toScopeProfile);

export const ammoForCaliber = async (caliber: string | null): Promise<Ammo[]> => {
  const all = await loadAmmo();
  return caliber ? all.filter((a) => a.caliber === caliber) : all;
};

export interface SessionTree {
  session: SessionRow;
  gun: Gun | null;
  sets: { set: SetRow; targets: { target: TargetRow; shots: ShotRow[] }[] }[];
  stats: ShotStats;
}

export async function loadSessionTree(sessionId: string): Promise<SessionTree | null> {
  const sRow = await getById('sessions', sessionId);
  if (!sRow) return null;
  const session = toSession(sRow);
  const gun = await loadGun(session.gunId);
  const setRows = (await getWhere('sets', 'sessionId', sessionId))
    .map(toSet)
    .sort((a, b) => a.order - b.order);
  const sets: SessionTree['sets'] = [];
  const allScores: number[] = [];
  for (const set of setRows) {
    const targetRows = (await getWhere('targets', 'setId', set.id)).map(toTarget);
    const targets: SessionTree['sets'][number]['targets'] = [];
    for (const target of targetRows) {
      const shots = (await getWhere('shots', 'targetId', target.id))
        .map(toShot)
        .sort((a, b) => a.index - b.index);
      for (const sh of shots) if (sh.ringValue != null) allScores.push(sh.ringValue);
      targets.push({ target, shots });
    }
    sets.push({ set, targets });
  }
  return { session, gun, sets, stats: computeShotStats(allScores) };
}

/** Points for a scored shot value or IPSC zone (mirrors the server's scoring). */
export function shotPoints(ringValue: number | null, zone: string | null): number {
  if (zone) return zonePoints(zone);
  return ringValue ?? 0;
}

/** Just the scoring stats for a session (used by the session list). */
export async function loadSessionStats(sessionId: string): Promise<ShotStats> {
  const tree = await loadSessionTree(sessionId);
  return tree?.stats ?? computeShotStats([]);
}

/** Format a nullable stat value for display. */
export function fmtStat(v: number | null): string {
  return v == null ? '—' : v.toFixed(1);
}
