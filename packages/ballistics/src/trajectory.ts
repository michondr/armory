import { airDensity, speedOfSound, STANDARD_ATMOSPHERE, type Atmosphere } from './atmosphere.js';
import { dragCoefficient, type DragModel } from './drag-tables.js';

// Point-mass ("3-DOF") trajectory: gravity + aerodynamic drag against the wind-
// relative velocity. Drag magnitude comes from the standard G1/G7 reference curve
// scaled by the ballistic coefficient. Spin drift / Coriolis are intentionally
// omitted — negligible next to wind + drop at the ranges this app targets.

const G = 9.80665; // m/s²
// 1 lb/in² expressed as kg/m² — converts a shooter's BC into SI sectional density.
const LBIN2_TO_KGM2 = 703.06957964;
// dv/dt = -(π/8)·ρ·Cd(M)/BC · |v_rel| · v_rel   (BC in kg/m²)
const DRAG_K = Math.PI / 8;

export interface Vec3 {
  x: number; // downrange (m)
  y: number; // vertical, up positive (m)
  z: number; // lateral, right positive (m)
}

export interface TrajectoryInputs {
  muzzleVelocityMps: number;
  /** Ballistic coefficient in lb/in² (the value printed on the box), for `dragModel`. */
  ballisticCoefficient: number;
  dragModel: DragModel;
  /** Height of the optic's line of sight above the bore, mm. */
  sightHeightMm: number;
  /** Range at which the rifle is zeroed, m. */
  zeroRangeM: number;
  /** Wind speed, m/s. */
  windSpeedMps?: number;
  /**
   * Wind direction as a clock angle, degrees. 0/360 = headwind (from 12 o'clock),
   * 90 = from the right (3 o'clock, pushes left), 180 = tailwind, 270 = from the left.
   */
  windAngleDeg?: number;
  atmosphere?: Atmosphere;
}

export interface TrajectoryPoint {
  rangeM: number;
  /** Drop relative to line of sight, m (negative = below LOS). */
  dropM: number;
  /** Wind deflection, m (positive = right). */
  windageM: number;
  velocityMps: number;
  timeOfFlightS: number;
  mach: number;
}

interface State {
  pos: Vec3;
  vel: Vec3;
  t: number;
}

interface Env {
  rho: number;
  sos: number;
  bcSi: number;
  model: DragModel;
  wind: Vec3;
}

function accel(vel: Vec3, env: Env): Vec3 {
  const rvx = vel.x - env.wind.x;
  const rvy = vel.y - env.wind.y;
  const rvz = vel.z - env.wind.z;
  const speed = Math.hypot(rvx, rvy, rvz);
  const mach = speed / env.sos;
  const cd = dragCoefficient(env.model, mach);
  const k = (DRAG_K * env.rho * cd) / env.bcSi; // 1/m
  const drag = k * speed;
  return {
    x: -drag * rvx,
    y: -drag * rvy - G,
    z: -drag * rvz,
  };
}

/** One RK4 step of dt seconds. */
function step(s: State, dt: number, env: Env): State {
  const a1 = accel(s.vel, env);
  const v2 = addScaled(s.vel, a1, dt / 2);
  const a2 = accel(v2, env);
  const v3 = addScaled(s.vel, a2, dt / 2);
  const a3 = accel(v3, env);
  const v4 = addScaled(s.vel, a3, dt);
  const a4 = accel(v4, env);

  const vel: Vec3 = {
    x: s.vel.x + (dt / 6) * (a1.x + 2 * a2.x + 2 * a3.x + a4.x),
    y: s.vel.y + (dt / 6) * (a1.y + 2 * a2.y + 2 * a3.y + a4.y),
    z: s.vel.z + (dt / 6) * (a1.z + 2 * a2.z + 2 * a3.z + a4.z),
  };
  // Position uses the RK4 velocity slopes (k1..k4 of velocity).
  const pos: Vec3 = {
    x: s.pos.x + (dt / 6) * (s.vel.x + 2 * v2.x + 2 * v3.x + v4.x),
    y: s.pos.y + (dt / 6) * (s.vel.y + 2 * v2.y + 2 * v3.y + v4.y),
    z: s.pos.z + (dt / 6) * (s.vel.z + 2 * v2.z + 2 * v3.z + v4.z),
  };
  return { pos, vel, t: s.t + dt };
}

function addScaled(v: Vec3, a: Vec3, k: number): Vec3 {
  return { x: v.x + a.x * k, y: v.y + a.y * k, z: v.z + a.z * k };
}

function makeEnv(inputs: TrajectoryInputs): Env {
  const atmo = inputs.atmosphere ?? STANDARD_ATMOSPHERE;
  const windSpeed = inputs.windSpeedMps ?? 0;
  const windAngle = ((inputs.windAngleDeg ?? 0) * Math.PI) / 180;
  // Clock angle → components. 0° headwind blows toward the shooter (-x); 90° from
  // the right blows to the left (-z).
  const wind: Vec3 = {
    x: -windSpeed * Math.cos(windAngle),
    y: 0,
    z: -windSpeed * Math.sin(windAngle),
  };
  return {
    rho: airDensity(atmo),
    sos: speedOfSound(atmo),
    bcSi: inputs.ballisticCoefficient * LBIN2_TO_KGM2,
    model: inputs.dragModel,
    wind,
  };
}

/**
 * Integrate until x reaches `maxRangeM`, sampling drop/windage/velocity. `launchAngle`
 * is the bore elevation above the line of sight (radians). Returns samples plus the
 * vertical position at max range (used by the zeroing solver).
 */
function integrate(
  inputs: TrajectoryInputs,
  env: Env,
  launchAngle: number,
  maxRangeM: number,
  sampleRangesM: number[],
): { samples: TrajectoryPoint[]; endDropAtMax: number } {
  const sightHeight = inputs.sightHeightMm / 1000;
  const v0 = inputs.muzzleVelocityMps;
  let s: State = {
    // Bullet starts at the muzzle, which sits sightHeight below the line of sight.
    pos: { x: 0, y: -sightHeight, z: 0 },
    vel: { x: v0 * Math.cos(launchAngle), y: v0 * Math.sin(launchAngle), z: 0 },
    t: 0,
  };

  const dt = 0.0005;
  const sorted = [...sampleRangesM].filter((r) => r > 0 && r <= maxRangeM).sort((a, b) => a - b);
  const samples: TrajectoryPoint[] = [];
  let nextIdx = 0;
  let endDropAtMax = s.pos.y;

  let guard = 0;
  const maxSteps = 2_000_000;
  while (s.pos.x < maxRangeM && guard++ < maxSteps) {
    const prev = s;
    s = step(s, dt, env);

    // Record any sample ranges we crossed this step (linear interp on x).
    while (nextIdx < sorted.length && s.pos.x >= sorted[nextIdx]!) {
      const target = sorted[nextIdx]!;
      samples.push(interpSample(prev, s, target, env));
      nextIdx++;
    }
    if (prev.pos.x < maxRangeM && s.pos.x >= maxRangeM) {
      endDropAtMax = lerpAtX(prev, s, maxRangeM).pos.y;
    }
    // Bullet fell far below LOS without reaching range (e.g. absurd inputs) — stop.
    if (s.vel.x <= 0) break;
  }

  return { samples, endDropAtMax };
}

function lerpAtX(a: State, b: State, x: number): State {
  const t = (x - a.pos.x) / (b.pos.x - a.pos.x);
  return {
    pos: {
      x,
      y: a.pos.y + t * (b.pos.y - a.pos.y),
      z: a.pos.z + t * (b.pos.z - a.pos.z),
    },
    vel: {
      x: a.vel.x + t * (b.vel.x - a.vel.x),
      y: a.vel.y + t * (b.vel.y - a.vel.y),
      z: a.vel.z + t * (b.vel.z - a.vel.z),
    },
    t: a.t + t * (b.t - a.t),
  };
}

function interpSample(a: State, b: State, x: number, env: Env): TrajectoryPoint {
  const s = lerpAtX(a, b, x);
  const speed = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
  return {
    rangeM: x,
    dropM: s.pos.y,
    windageM: s.pos.z,
    velocityMps: speed,
    timeOfFlightS: s.t,
    mach: speed / env.sos,
  };
}

/**
 * Find the bore elevation (radians) that puts the bullet on the line of sight at
 * the zero range. Monotonic in launch angle → secant iteration.
 */
export function solveZeroAngle(inputs: TrajectoryInputs, env: Env): number {
  const dropAtZero = (angle: number): number =>
    integrate(inputs, env, angle, inputs.zeroRangeM, []).endDropAtMax;

  let a0 = 0;
  let f0 = dropAtZero(a0);
  // Initial guess: angle whose straight-line rise covers the drop seen at 0°.
  let a1 = Math.max(1e-4, -f0 / inputs.zeroRangeM);
  let f1 = dropAtZero(a1);

  for (let i = 0; i < 30; i++) {
    if (Math.abs(f1) < 1e-4) break; // within 0.1 mm at the zero range
    const denom = f1 - f0;
    if (denom === 0) break;
    const a2 = a1 - f1 * ((a1 - a0) / denom);
    a0 = a1;
    f0 = f1;
    a1 = a2;
    f1 = dropAtZero(a1);
  }
  return a1;
}

export interface SolvedTrajectory {
  zeroAngleRad: number;
  points: TrajectoryPoint[];
  env: Env;
}

/** Zero the rifle, then sample the trajectory at the requested ranges. */
export function solveTrajectory(
  inputs: TrajectoryInputs,
  sampleRangesM: number[],
): SolvedTrajectory {
  const env = makeEnv(inputs);
  const zeroAngle = solveZeroAngle(inputs, env);
  const maxRange = Math.max(inputs.zeroRangeM, ...sampleRangesM, 1);
  const { samples } = integrate(inputs, env, zeroAngle, maxRange, sampleRangesM);
  return { zeroAngleRad: zeroAngle, points: samples, env };
}
