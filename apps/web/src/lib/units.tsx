import { useQuery } from '@tanstack/react-query';
import {
  fpsToMps,
  grainsToGrams,
  gramsToGrains,
  mpsToFps,
  type UnitSystem,
} from '@armory/shared';
import { settingsApi } from './api';

export function useSettingsQuery() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsApi.get, staleTime: 60_000 });
}

export function useUnitSystem(): UnitSystem {
  const { data } = useSettingsQuery();
  return data?.unitSystem ?? 'METRIC';
}

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Bullet weight: stored grams; displayed grains (imperial) or grams (metric).
export const weightUnit = (s: UnitSystem): string => (s === 'IMPERIAL' ? 'gr' : 'g');
export const weightFromG = (g: number, s: UnitSystem): number =>
  round(s === 'IMPERIAL' ? gramsToGrains(g) : g, 1);
export const weightToG = (v: number, s: UnitSystem): number =>
  s === 'IMPERIAL' ? grainsToGrams(v) : v;

// Muzzle velocity: stored m/s; displayed fps (imperial) or m/s (metric).
export const velocityUnit = (s: UnitSystem): string => (s === 'IMPERIAL' ? 'fps' : 'm/s');
export const velocityFromMps = (mps: number, s: UnitSystem): number =>
  round(s === 'IMPERIAL' ? mpsToFps(mps) : mps, 0);
export const velocityToMps = (v: number, s: UnitSystem): number =>
  s === 'IMPERIAL' ? fpsToMps(v) : v;
