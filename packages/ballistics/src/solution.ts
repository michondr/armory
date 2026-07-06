import { STANDARD_ATMOSPHERE, type Atmosphere } from './atmosphere.js';
import type { DragModel } from './drag-tables.js';
import { solveTrajectory, type TrajectoryInputs } from './trajectory.js';

// Turns a trajectory sample at the target range into a shooter-facing firing
// solution: elevation + windage in clicks, plus the full derivation (drop → angle
// → clicks) so the mobile/web "advanced info" view can teach how it's computed.

export type AngularUnit = 'MRAD' | 'MOA';

const MOA_PER_RAD = (180 / Math.PI) * 60; // 1 rad in MOA
const MRAD_PER_RAD = 1000; // 1 rad in mrad (milliradian)

export interface ScopeInputs {
  /** Click size in `angularUnit` (e.g. 0.1 MRAD, 0.25 MOA). */
  clickValue: number;
  angularUnit: AngularUnit;
}

export interface FiringSolutionInputs extends ScopeInputs {
  muzzleVelocityMps: number;
  ballisticCoefficient: number;
  dragModel: DragModel;
  sightHeightMm: number;
  zeroRangeM: number;
  targetRangeM: number;
  windSpeedMps?: number;
  windAngleDeg?: number;
  atmosphere?: Atmosphere;
}

export interface AngularAdjustment {
  /** Angle in radians (magnitude + sign; up / right positive). */
  radians: number;
  moa: number;
  mrad: number;
  /** Clicks in the scope's own unit (rounded to the nearest click). */
  clicks: number;
  /** Value in the scope's own unit before rounding to clicks. */
  inScopeUnit: number;
}

export interface FiringSolution {
  targetRangeM: number;
  /** Come-up above the zero, i.e. how far to dial UP. */
  elevation: AngularAdjustment;
  /** Hold/dial into the wind; positive = right. */
  windage: AngularAdjustment;
  dropM: number;
  windageM: number;
  velocityMps: number;
  /** Retained energy needs mass; velocity + Mach are what we expose here. */
  mach: number;
  timeOfFlightS: number;
  supersonic: boolean;
}

function toAdjustment(radians: number, scope: ScopeInputs): AngularAdjustment {
  const moa = radians * MOA_PER_RAD;
  const mrad = radians * MRAD_PER_RAD;
  const inScopeUnit = scope.angularUnit === 'MOA' ? moa : mrad;
  const clicks = Math.round(inScopeUnit / scope.clickValue);
  return { radians, moa, mrad, clicks, inScopeUnit };
}

export function solveFiringSolution(inputs: FiringSolutionInputs): FiringSolution {
  const trajInputs: TrajectoryInputs = {
    muzzleVelocityMps: inputs.muzzleVelocityMps,
    ballisticCoefficient: inputs.ballisticCoefficient,
    dragModel: inputs.dragModel,
    sightHeightMm: inputs.sightHeightMm,
    zeroRangeM: inputs.zeroRangeM,
    windSpeedMps: inputs.windSpeedMps,
    windAngleDeg: inputs.windAngleDeg,
    atmosphere: inputs.atmosphere ?? STANDARD_ATMOSPHERE,
  };

  const solved = solveTrajectory(trajInputs, [inputs.targetRangeM]);
  const p = solved.points[0];
  if (!p) {
    throw new Error('Trajectory did not reach the target range (check muzzle velocity / BC)');
  }

  // Elevation: angle to dial up = -drop / range (drop is negative below LOS).
  const elevationRad = -p.dropM / inputs.targetRangeM;
  // Windage: angle to the deflection at range.
  const windageRad = p.windageM / inputs.targetRangeM;

  return {
    targetRangeM: inputs.targetRangeM,
    elevation: toAdjustment(elevationRad, inputs),
    windage: toAdjustment(windageRad, inputs),
    dropM: p.dropM,
    windageM: p.windageM,
    velocityMps: p.velocityMps,
    mach: p.mach,
    timeOfFlightS: p.timeOfFlightS,
    supersonic: p.mach >= 1,
  };
}

export interface RangeCardRow {
  rangeM: number;
  elevation: AngularAdjustment;
  windage: AngularAdjustment;
  dropM: number;
  windageM: number;
  velocityMps: number;
  timeOfFlightS: number;
  supersonic: boolean;
}

/** A come-up table across several ranges from one integration pass. */
export function buildRangeCard(
  inputs: Omit<FiringSolutionInputs, 'targetRangeM'>,
  rangesM: number[],
): RangeCardRow[] {
  const trajInputs: TrajectoryInputs = {
    muzzleVelocityMps: inputs.muzzleVelocityMps,
    ballisticCoefficient: inputs.ballisticCoefficient,
    dragModel: inputs.dragModel,
    sightHeightMm: inputs.sightHeightMm,
    zeroRangeM: inputs.zeroRangeM,
    windSpeedMps: inputs.windSpeedMps,
    windAngleDeg: inputs.windAngleDeg,
    atmosphere: inputs.atmosphere ?? STANDARD_ATMOSPHERE,
  };
  const solved = solveTrajectory(trajInputs, rangesM);
  return solved.points.map((p) => ({
    rangeM: p.rangeM,
    elevation: toAdjustment(-p.dropM / p.rangeM, inputs),
    windage: toAdjustment(p.windageM / p.rangeM, inputs),
    dropM: p.dropM,
    windageM: p.windageM,
    velocityMps: p.velocityMps,
    timeOfFlightS: p.timeOfFlightS,
    supersonic: p.mach >= 1,
  }));
}
