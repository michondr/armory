// Canonical storage is SI (meters, m/s, grams, millimeters). These helpers convert
// to/from the user's chosen display units. Kept dependency-free so mobile + web + api
// can all use them. Ballistics-specific angular math lands in @armory/ballistics later.

const M_PER_YARD = 0.9144;
const MM_PER_INCH = 25.4;
const FPS_PER_MPS = 3.280839895;
const GRAINS_PER_GRAM = 15.4323583529;

export const metersToYards = (m: number): number => m / M_PER_YARD;
export const yardsToMeters = (yd: number): number => yd * M_PER_YARD;

export const mmToInch = (mm: number): number => mm / MM_PER_INCH;
export const inchToMm = (inch: number): number => inch * MM_PER_INCH;

export const mpsToFps = (mps: number): number => mps * FPS_PER_MPS;
export const fpsToMps = (fps: number): number => fps / FPS_PER_MPS;

export const gramsToGrains = (g: number): number => g * GRAINS_PER_GRAM;
export const grainsToGrams = (gr: number): number => gr / GRAINS_PER_GRAM;

/** 1 MRAD = 3.43774677 MOA. */
export const mradToMoa = (mrad: number): number => mrad * 3.43774677;
export const moaToMrad = (moa: number): number => moa / 3.43774677;
