import { describe, expect, it } from 'vitest';
import { airDensity, speedOfSound, STANDARD_ATMOSPHERE } from './atmosphere.js';
import { dragCoefficient } from './drag-tables.js';
import { solveTrajectory } from './trajectory.js';
import { buildRangeCard, solveFiringSolution, type FiringSolutionInputs } from './solution.js';

const G = 9.80665;

// A representative long-range load: .308 175gr SMK, G7 BC ~0.243, ~790 m/s.
const load308: FiringSolutionInputs = {
  muzzleVelocityMps: 790,
  ballisticCoefficient: 0.243,
  dragModel: 'G7',
  sightHeightMm: 50,
  zeroRangeM: 100,
  targetRangeM: 900,
  clickValue: 0.1,
  angularUnit: 'MRAD',
};

describe('drag tables', () => {
  it('interpolates between table points and clamps the ends', () => {
    expect(dragCoefficient('G1', 0)).toBeCloseTo(0.2629, 4);
    expect(dragCoefficient('G1', 10)).toBeCloseTo(0.4988, 4); // clamped to last
    // Midpoint of [1.0,0.4805] and [1.025,0.5136] at Mach 1.0125.
    expect(dragCoefficient('G1', 1.0125)).toBeCloseTo((0.4805 + 0.5136) / 2, 3);
  });
});

describe('atmosphere', () => {
  it('matches standard sea-level density and sound speed', () => {
    expect(airDensity(STANDARD_ATMOSPHERE)).toBeCloseTo(1.225, 2);
    expect(speedOfSound(STANDARD_ATMOSPHERE)).toBeCloseTo(340.3, 0);
  });

  it('is denser when cold', () => {
    const cold = airDensity({ temperatureC: -10, pressureHpa: 1013.25, humidity: 0 });
    const hot = airDensity({ temperatureC: 35, pressureHpa: 1013.25, humidity: 0 });
    expect(cold).toBeGreaterThan(hot);
  });
});

describe('zeroing', () => {
  it('puts the bullet on the line of sight at the zero range', () => {
    const solved = solveTrajectory(
      { ...load308 },
      [load308.zeroRangeM],
    );
    // Drop at the zero range must be ~0 (within 2 mm).
    expect(Math.abs(solved.points[0]!.dropM)).toBeLessThan(0.002);
  });
});

describe('near-vacuum trajectory matches the analytic parabola', () => {
  it('reproduces projectile motion when drag is negligible', () => {
    const v0 = 800;
    const h = 0.05;
    const zero = 100;
    const target = 800;
    const bc = 1000; // enormous BC → drag ≈ 0

    const solved = solveTrajectory(
      {
        muzzleVelocityMps: v0,
        ballisticCoefficient: bc,
        dragModel: 'G1',
        sightHeightMm: h * 1000,
        zeroRangeM: zero,
      },
      [target],
    );

    // Analytic vacuum: drop below bore line D(x) = 0.5 g (x/v0)^2, bore angle
    // θ = (h + D(zero)) / zero, height above LOS y(x) = -h + xθ - D(x).
    const D = (x: number) => 0.5 * G * (x / v0) ** 2;
    const theta = (h + D(zero)) / zero;
    const yTarget = -h + target * theta - D(target);
    const analyticComeUpMrad = (-yTarget / target) * 1000;

    const solverComeUpMrad = (-solved.points[0]!.dropM / target) * 1000;
    expect(solverComeUpMrad).toBeCloseTo(analyticComeUpMrad, 1); // within ~0.05 mrad
  });
});

describe('firing solution', () => {
  it('produces a plausible come-up for a known .308 load', () => {
    const sol = solveFiringSolution(load308);
    // .308 175gr from a 100 m zero needs roughly 9–13 mrad at 900 m.
    expect(sol.elevation.mrad).toBeGreaterThan(9);
    expect(sol.elevation.mrad).toBeLessThan(13);
    expect(sol.velocityMps).toBeLessThan(load308.muzzleVelocityMps);
    // This load is still supersonic at 700 m (goes transonic ~850 m).
    const mid = solveFiringSolution({ ...load308, targetRangeM: 700 });
    expect(mid.supersonic).toBe(true);
  });

  it('come-up and time of flight grow with range; velocity falls', () => {
    const card = buildRangeCard(load308, [100, 300, 500, 700, 900]);
    for (let i = 1; i < card.length; i++) {
      expect(card[i]!.elevation.mrad).toBeGreaterThan(card[i - 1]!.elevation.mrad);
      expect(card[i]!.timeOfFlightS).toBeGreaterThan(card[i - 1]!.timeOfFlightS);
      expect(card[i]!.velocityMps).toBeLessThan(card[i - 1]!.velocityMps);
    }
  });

  it('rounds angular adjustment to whole clicks in the scope unit', () => {
    const sol = solveFiringSolution(load308);
    expect(sol.elevation.clicks).toBe(Math.round(sol.elevation.mrad / 0.1));
    // MOA scope on the same drop: clicks reflect the MOA value / click size.
    const moaSol = solveFiringSolution({ ...load308, angularUnit: 'MOA', clickValue: 0.25 });
    expect(moaSol.elevation.moa).toBeCloseTo(sol.elevation.mrad * 3.43774677, 3);
    expect(moaSol.elevation.clicks).toBe(Math.round(moaSol.elevation.moa / 0.25));
  });
});

describe('wind', () => {
  it('a wind from the right pushes the bullet left, and vice versa', () => {
    const fromRight = solveFiringSolution({ ...load308, windSpeedMps: 5, windAngleDeg: 90 });
    const fromLeft = solveFiringSolution({ ...load308, windSpeedMps: 5, windAngleDeg: 270 });
    expect(fromRight.windageM).toBeLessThan(0);
    expect(fromLeft.windageM).toBeGreaterThan(0);
    expect(fromRight.windage.clicks).toBeLessThan(0);
    // Symmetric magnitude.
    expect(Math.abs(fromRight.windageM)).toBeCloseTo(Math.abs(fromLeft.windageM), 3);
  });

  it('no wind means no windage', () => {
    const sol = solveFiringSolution({ ...load308, windSpeedMps: 0 });
    expect(Math.abs(sol.windageM)).toBeLessThan(1e-6);
    expect(sol.windage.clicks).toBe(0);
  });
});

describe('atmosphere effect on drop', () => {
  it('cold dense air needs more elevation than hot thin air', () => {
    const cold = solveFiringSolution({
      ...load308,
      atmosphere: { temperatureC: -10, pressureHpa: 1013.25, humidity: 0 },
    });
    const hot = solveFiringSolution({
      ...load308,
      atmosphere: { temperatureC: 35, pressureHpa: 900, humidity: 0 },
    });
    expect(cold.elevation.mrad).toBeGreaterThan(hot.elevation.mrad);
  });
});
