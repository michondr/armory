import type { AmmoSuggestion } from '@armory/shared';

// Bundled seed for autosuggest. Values are approximate typical factory loads, stored
// in SI (grams, m/s); users edit after picking. Online lookup arrives in Phase 5.
export const AMMO_SEED: AmmoSuggestion[] = [
  { name: '9mm Luger 115gr FMJ', caliber: '9mm Luger', bulletWeightG: 7.45, muzzleVelocityMps: 360, ballisticCoefficient: 0.14, bcModel: 'G1' },
  { name: '9mm Luger 124gr FMJ', caliber: '9mm Luger', bulletWeightG: 8.03, muzzleVelocityMps: 340, ballisticCoefficient: 0.16, bcModel: 'G1' },
  { name: '9mm Luger 147gr JHP', caliber: '9mm Luger', bulletWeightG: 9.53, muzzleVelocityMps: 300, ballisticCoefficient: 0.19, bcModel: 'G1' },
  { name: '.22 LR 40gr', caliber: '.22 LR', bulletWeightG: 2.59, muzzleVelocityMps: 330, ballisticCoefficient: 0.12, bcModel: 'G1' },
  { name: '.223 Rem 55gr FMJ', caliber: '.223 Remington', bulletWeightG: 3.56, muzzleVelocityMps: 990, ballisticCoefficient: 0.243, bcModel: 'G1' },
  { name: '5.56 NATO 62gr M855', caliber: '5.56x45mm NATO', bulletWeightG: 4.02, muzzleVelocityMps: 940, ballisticCoefficient: 0.307, bcModel: 'G1' },
  { name: '.308 Win 168gr HPBT', caliber: '.308 Winchester', bulletWeightG: 10.89, muzzleVelocityMps: 800, ballisticCoefficient: 0.462, bcModel: 'G1' },
  { name: '.308 Win 175gr HPBT', caliber: '.308 Winchester', bulletWeightG: 11.34, muzzleVelocityMps: 790, ballisticCoefficient: 0.505, bcModel: 'G1' },
  { name: '6.5 Creedmoor 140gr ELD', caliber: '6.5 Creedmoor', bulletWeightG: 9.07, muzzleVelocityMps: 820, ballisticCoefficient: 0.61, bcModel: 'G1' },
  { name: '6.5 Creedmoor 143gr ELD-X', caliber: '6.5 Creedmoor', bulletWeightG: 9.27, muzzleVelocityMps: 810, ballisticCoefficient: 0.625, bcModel: 'G1' },
  { name: '7.62x39 123gr FMJ', caliber: '7.62x39mm', bulletWeightG: 7.97, muzzleVelocityMps: 730, ballisticCoefficient: 0.28, bcModel: 'G1' },
  { name: '.300 Win Mag 190gr', caliber: '.300 Winchester Magnum', bulletWeightG: 12.31, muzzleVelocityMps: 900, ballisticCoefficient: 0.53, bcModel: 'G1' },
  { name: '.300 BLK 220gr subsonic', caliber: '.300 AAC Blackout', bulletWeightG: 14.26, muzzleVelocityMps: 305, ballisticCoefficient: 0.6, bcModel: 'G1' },
  { name: '.338 Lapua 250gr', caliber: '.338 Lapua Magnum', bulletWeightG: 16.2, muzzleVelocityMps: 900, ballisticCoefficient: 0.675, bcModel: 'G1' },
  { name: '.45 ACP 230gr FMJ', caliber: '.45 ACP', bulletWeightG: 14.9, muzzleVelocityMps: 260, ballisticCoefficient: 0.19, bcModel: 'G1' },
  { name: '.40 S&W 180gr FMJ', caliber: '.40 S&W', bulletWeightG: 11.66, muzzleVelocityMps: 300, ballisticCoefficient: 0.14, bcModel: 'G1' },
];
