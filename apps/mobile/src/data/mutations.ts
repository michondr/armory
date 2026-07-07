import { getWhere, newId, softDeleteLocal, upsertLocal } from '../db/repo';
import { isLocalUri, queueImage } from '../sync/images';
import { shotPoints } from './models';

// All mobile writes go through here: they write to the local mirror (marking the
// row dirty) so the UI updates instantly offline; the sync engine pushes later.

export interface GunInput {
  id?: string;
  name: string;
  caliber: string | null;
  notes: string | null;
  initialRoundCount: number;
  cleaningIntervalRounds: number | null;
  lastCleanedAtRound: number;
  imagePath: string | null;
}

export async function saveGun(input: GunInput): Promise<string> {
  const id = input.id ?? newId();
  await upsertLocal('guns', {
    id,
    name: input.name,
    caliber: input.caliber,
    notes: input.notes,
    initialRoundCount: input.initialRoundCount,
    cleaningIntervalRounds: input.cleaningIntervalRounds,
    lastCleanedAtRound: input.lastCleanedAtRound,
    imagePath: input.imagePath,
    purchasePrice: null,
    purchaseDate: null,
  });
  // A freshly captured photo is a local file URI — queue it for upload so the
  // sync engine swaps in the server path before pushing the gun row.
  if (input.imagePath && isLocalUri(input.imagePath)) {
    await queueImage('guns', id, input.imagePath, 'imagePath');
  }
  return id;
}

export const deleteGun = (id: string) => softDeleteLocal('guns', id);

export interface AmmoInput {
  id?: string;
  name: string;
  caliber: string | null;
  bulletWeightG: number | null;
  muzzleVelocityMps: number | null;
  ballisticCoefficient: number | null;
  bcModel: 'G1' | 'G7' | null;
  notes: string | null;
}

export async function saveAmmo(input: AmmoInput): Promise<string> {
  const id = input.id ?? newId();
  await upsertLocal('ammo', { ...input, id });
  return id;
}

export const deleteAmmo = (id: string) => softDeleteLocal('ammo', id);

/** Attach a captured photo to an ammo entry (multiple images allowed per ammo). */
export async function addAmmoImage(ammoId: string, localUri: string): Promise<string> {
  const id = newId();
  await upsertLocal('ammoImages', { id, ammoId, imagePath: localUri });
  await queueImage('ammoImages', id, localUri, 'imagePath');
  return id;
}

export const deleteAmmoImage = (id: string) => softDeleteLocal('ammoImages', id);

export async function saveCartridge(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = (await getWhere('cartridges', 'name', trimmed))[0];
  if (existing) return;
  await upsertLocal('cartridges', { id: newId(), name: trimmed });
}

export interface ScopeProfileInput {
  id?: string;
  gunId: string;
  name: string;
  clickValue: number;
  angularUnit: 'MRAD' | 'MOA';
  zeroRangeM: number;
  sightHeightMm: number;
  notes: string | null;
}

export async function saveScopeProfile(input: ScopeProfileInput): Promise<string> {
  const id = input.id ?? newId();
  await upsertLocal('scopeProfiles', { ...input, id });
  return id;
}

export const deleteScopeProfile = (id: string) => softDeleteLocal('scopeProfiles', id);

export interface SessionInput {
  id?: string;
  gunId: string;
  ammoId: string | null;
  startedAt: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  discipline: 'SHORT' | 'LONG';
  notes: string | null;
}

export async function saveSession(input: SessionInput): Promise<string> {
  const id = input.id ?? newId();
  await upsertLocal('sessions', { ...input, id });
  return id;
}

export const deleteSession = (id: string) => softDeleteLocal('sessions', id);

export async function addSet(
  sessionId: string,
  distanceM: number | null,
  order: number,
): Promise<string> {
  const id = newId();
  await upsertLocal('sets', {
    id,
    sessionId,
    order,
    distanceM,
    ipscTimeSeconds: null,
    notes: null,
  });
  return id;
}

export const deleteSet = (id: string) => softDeleteLocal('sets', id);

export async function setSetIpscTime(setId: string, seconds: number | null) {
  await upsertLocal('sets', { id: setId, ipscTimeSeconds: seconds });
}

export async function addTarget(
  setId: string,
  scoringSystem: 'RINGS' | 'IPSC' | 'GROUP',
  maxScorePerShot: number | null,
): Promise<string> {
  const id = newId();
  await upsertLocal('targets', {
    id,
    setId,
    imagePath: null,
    shotCount: 0,
    scoringSystem,
    maxScorePerShot,
    status: 'PENDING',
    totalScore: null,
    notes: null,
  });
  return id;
}

export const deleteTarget = (id: string) => softDeleteLocal('targets', id);

/** Attach a captured photo: store the local URI now, queue it for upload. */
export async function attachTargetImage(targetId: string, localUri: string): Promise<void> {
  // upsertLocal merges with the existing target row, so we only pass the change.
  await upsertLocal('targets', { id: targetId, imagePath: localUri });
  await queueImage('targets', targetId, localUri, 'imagePath');
}

export interface PlacedShot {
  x: number | null;
  y: number | null;
  ringValue: number | null;
  zone: string | null;
}

/** Replace a target's shots (tap-to-place or text entry) and recompute the score. */
export async function setTargetShots(targetId: string, shots: PlacedShot[]): Promise<void> {
  // Soft-delete existing shots so other devices get the tombstones.
  const existing = await getWhere('shots', 'targetId', targetId);
  for (const s of existing) await softDeleteLocal('shots', String(s.id));

  let total = 0;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    const value = shotPoints(s.ringValue, s.zone);
    total += value;
    await upsertLocal('shots', {
      id: newId(),
      targetId,
      index: i,
      ringValue: s.zone ? value : s.ringValue,
      x: s.x,
      y: s.y,
      zone: s.zone,
      source: 'MANUAL',
    });
  }

  await upsertLocal('targets', {
    id: targetId,
    totalScore: shots.length ? total : null,
    status: 'MANUAL',
    ...(shots.length ? { shotCount: shots.length } : {}),
  });
}
