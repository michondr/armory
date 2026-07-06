// Air density + speed of sound from the shooting environment. Drives the drag
// term in the trajectory solver. Defaults are ICAO standard sea level.

export interface Atmosphere {
  /** °C */
  temperatureC: number;
  /** Station (absolute) pressure in hectopascals / millibars. */
  pressureHpa: number;
  /** Relative humidity 0..1. */
  humidity: number;
}

export const STANDARD_ATMOSPHERE: Atmosphere = {
  temperatureC: 15,
  pressureHpa: 1013.25,
  humidity: 0,
};

const R_DRY = 287.058; // J/(kg·K), specific gas constant, dry air
const R_VAPOR = 461.495; // J/(kg·K), water vapour

/** Saturation vapour pressure of water (Pa) via the Tetens formula. */
function saturationVaporPressurePa(tempC: number): number {
  return 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/** Air density (kg/m³) accounting for humidity (moist air is slightly less dense). */
export function airDensity(atmo: Atmosphere): number {
  const tempK = atmo.temperatureC + 273.15;
  const pTotal = atmo.pressureHpa * 100; // Pa
  const pVapor = clamp(atmo.humidity, 0, 1) * saturationVaporPressurePa(atmo.temperatureC);
  const pDry = pTotal - pVapor;
  return pDry / (R_DRY * tempK) + pVapor / (R_VAPOR * tempK);
}

/** Speed of sound (m/s) in air at the given temperature. */
export function speedOfSound(atmo: Atmosphere): number {
  const tempK = atmo.temperatureC + 273.15;
  return 20.0457 * Math.sqrt(tempK);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
