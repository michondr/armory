// Domain enums shared across api, web, and mobile.
// Declared as const objects (values) + matching types so they can be used at
// runtime (Zod, UI selects) and at the type level.

export const UnitSystem = {
  METRIC: 'METRIC',
  IMPERIAL: 'IMPERIAL',
} as const;
export type UnitSystem = (typeof UnitSystem)[keyof typeof UnitSystem];

/** Scope adjustment angular unit. Stored per user (and later per scope profile). */
export const AngularUnit = {
  MRAD: 'MRAD',
  MOA: 'MOA',
} as const;
export type AngularUnit = (typeof AngularUnit)[keyof typeof AngularUnit];

/** Range discipline. LONG sessions expose the ballistics/scope tooling (mobile). */
export const Discipline = {
  SHORT: 'SHORT',
  LONG: 'LONG',
} as const;
export type Discipline = (typeof Discipline)[keyof typeof Discipline];

export const ScoringSystem = {
  RINGS: 'RINGS',
  IPSC: 'IPSC',
  GROUP: 'GROUP',
} as const;
export type ScoringSystem = (typeof ScoringSystem)[keyof typeof ScoringSystem];

export const TargetStatus = {
  PENDING: 'PENDING',
  SCORED: 'SCORED',
  APPROVED: 'APPROVED',
  MANUAL: 'MANUAL',
} as const;
export type TargetStatus = (typeof TargetStatus)[keyof typeof TargetStatus];

/** Where a shot's data came from: vision detection or manual entry. */
export const ShotSource = {
  AI: 'AI',
  MANUAL: 'MANUAL',
} as const;
export type ShotSource = (typeof ShotSource)[keyof typeof ShotSource];

/** Ballistic-coefficient drag model. G1 (flat-base) is most common; G7 suits long boat-tails. */
export const BcModel = {
  G1: 'G1',
  G7: 'G7',
} as const;
export type BcModel = (typeof BcModel)[keyof typeof BcModel];

export const UNIT_SYSTEMS = Object.values(UnitSystem);
export const ANGULAR_UNITS = Object.values(AngularUnit);
export const DISCIPLINES = Object.values(Discipline);
export const SCORING_SYSTEMS = Object.values(ScoringSystem);
export const TARGET_STATUSES = Object.values(TargetStatus);
export const BC_MODELS = Object.values(BcModel);
