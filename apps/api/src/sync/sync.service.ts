import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  SyncAmmo,
  SyncAmmoImage,
  SyncAmmoPriceEntry,
  SyncCartridge,
  SyncChanges,
  SyncGun,
  SyncPullResponse,
  SyncPushInput,
  SyncPushResponse,
  SyncRemappedRow,
  SyncScopeProfile,
  SyncSession,
  SyncSet,
  SyncShot,
  SyncSkippedRow,
  SyncTable,
  SyncTarget,
} from '@armory/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pull/push sync for the mobile app.
 *
 * - Rows are full snapshots with client-generated UUIDs; deletes are tombstones
 *   (deletedAt) so they propagate.
 * - Conflicts resolve last-write-wins: an incoming row only replaces the stored
 *   one if its updatedAt is newer. On accept the server stamps its own clock,
 *   so every stored updatedAt is server time and the pull cursor (also server
 *   time) is consistent.
 * - Pulls re-send a small window before `since` to cover writes that committed
 *   while a previous pull was in flight; clients apply pulls idempotently.
 */
const PULL_OVERLAP_MS = 10_000;

interface RowMeta {
  userId: string;
  updatedAt: Date;
}

/** Common shape every synced wire row shares. */
interface WireRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface TableOps<Row extends WireRow> {
  table: SyncTable;
  rows: Row[] | undefined;
  findMeta(id: string): Promise<RowMeta | null>;
  /** Returns a skip reason when the row's parent is missing or foreign. */
  parentCheck?(row: Row): Promise<string | null>;
  create(row: Row): Promise<void>;
  update(row: Row): Promise<void>;
  fetchWire(id: string): Promise<Row | null>;
  /** Handles unique-constraint conflicts; returns the authoritative row id, or null to skip. */
  onUniqueConflict?(row: Row): Promise<string | null>;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(userId: string, since?: string): Promise<SyncPullResponse> {
    let gt = new Date(0);
    if (since !== undefined) {
      const parsed = Date.parse(since);
      if (Number.isNaN(parsed)) throw new BadRequestException('Invalid since cursor');
      gt = new Date(parsed - PULL_OVERLAP_MS);
    }
    const cursor = new Date().toISOString();
    const where = { userId, updatedAt: { gt } };
    const orderBy = { updatedAt: 'asc' as const };

    const [
      cartridges,
      guns,
      ammo,
      ammoImages,
      ammoPriceEntries,
      scopeProfiles,
      sessions,
      sets,
      targets,
      shots,
    ] = await Promise.all([
      this.prisma.cartridge.findMany({ where, orderBy }),
      this.prisma.gun.findMany({ where, orderBy }),
      this.prisma.ammo.findMany({ where, orderBy }),
      this.prisma.ammoImage.findMany({ where, orderBy }),
      this.prisma.ammoPriceEntry.findMany({ where, orderBy }),
      this.prisma.scopeProfile.findMany({ where, orderBy }),
      this.prisma.session.findMany({ where, orderBy }),
      this.prisma.shootingSet.findMany({ where, orderBy }),
      this.prisma.target.findMany({ where, orderBy }),
      this.prisma.shot.findMany({ where, orderBy }),
    ]);

    return {
      cursor,
      changes: {
        cartridges: cartridges.map(wireCartridge),
        guns: guns.map(wireGun),
        ammo: ammo.map(wireAmmo),
        ammoImages: ammoImages.map(wireAmmoImage),
        ammoPriceEntries: ammoPriceEntries.map(wireAmmoPriceEntry),
        scopeProfiles: scopeProfiles.map(wireScopeProfile),
        sessions: sessions.map(wireSession),
        sets: sets.map(wireSet),
        targets: targets.map(wireTarget),
        shots: shots.map(wireShot),
      },
    };
  }

  async push(userId: string, input: SyncPushInput): Promise<SyncPushResponse> {
    if (input.device) {
      const dev = await this.prisma.device.findUnique({ where: { id: input.device.id } });
      if (!dev || dev.userId === userId) {
        await this.prisma.device.upsert({
          where: { id: input.device.id },
          create: {
            id: input.device.id,
            userId,
            name: input.device.name,
            platform: input.device.platform ?? null,
            lastSyncAt: new Date(),
          },
          update: {
            name: input.device.name,
            platform: input.device.platform ?? null,
            lastSyncAt: new Date(),
          },
        });
      }
    }

    const applied: SyncChanges = {};
    const skipped: SyncSkippedRow[] = [];
    const remapped: SyncRemappedRow[] = [];
    const c = input.changes;

    // Dependency order: parents before children so one batch applies cleanly.
    await this.applyTable(userId, this.cartridgeOps(userId, c.cartridges), applied, skipped, remapped);
    await this.applyTable(userId, this.gunOps(userId, c.guns), applied, skipped, remapped);
    await this.applyTable(userId, this.ammoOps(userId, c.ammo), applied, skipped, remapped);
    await this.applyTable(userId, this.ammoImageOps(userId, c.ammoImages), applied, skipped, remapped);
    await this.applyTable(userId, this.ammoPriceEntryOps(userId, c.ammoPriceEntries), applied, skipped, remapped);
    await this.applyTable(userId, this.scopeProfileOps(userId, c.scopeProfiles), applied, skipped, remapped);
    await this.applyTable(userId, this.sessionOps(userId, c.sessions), applied, skipped, remapped);
    await this.applyTable(userId, this.setOps(userId, c.sets), applied, skipped, remapped);
    await this.applyTable(userId, this.targetOps(userId, c.targets), applied, skipped, remapped);
    await this.applyTable(userId, this.shotOps(userId, c.shots), applied, skipped, remapped);

    return { cursor: new Date().toISOString(), applied, skipped, remapped };
  }

  private async applyTable<Row extends WireRow>(
    userId: string,
    ops: TableOps<Row>,
    applied: SyncChanges,
    skipped: SyncSkippedRow[],
    remapped: SyncRemappedRow[],
  ): Promise<void> {
    if (!ops.rows?.length) return;
    const appliedRows: Row[] = [];

    for (const row of ops.rows) {
      const existing = await ops.findMeta(row.id);
      if (existing && existing.userId !== userId) {
        skipped.push({ table: ops.table, id: row.id, reason: 'id belongs to another account' });
        continue;
      }
      if (existing && existing.updatedAt >= new Date(row.updatedAt)) {
        // Server row is newer (or same) — server wins; echo the authoritative row.
        const server = await ops.fetchWire(row.id);
        if (server) appliedRows.push(server);
        continue;
      }
      const parentProblem = ops.parentCheck ? await ops.parentCheck(row) : null;
      if (parentProblem) {
        skipped.push({ table: ops.table, id: row.id, reason: parentProblem });
        continue;
      }

      try {
        if (existing) await ops.update(row);
        else await ops.create(row);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          ops.onUniqueConflict
        ) {
          const toId = await ops.onUniqueConflict(row);
          if (toId) {
            remapped.push({ table: ops.table, fromId: row.id, toId });
            const server = await ops.fetchWire(toId);
            if (server) appliedRows.push(server);
          } else {
            skipped.push({ table: ops.table, id: row.id, reason: 'unique constraint conflict' });
          }
          continue;
        }
        throw err;
      }

      const server = await ops.fetchWire(row.id);
      if (server) appliedRows.push(server);
    }

    (applied as Record<string, Row[]>)[ops.table] = appliedRows;
  }

  // ---- per-table ops ----

  private cartridgeOps(userId: string, rows: SyncCartridge[] | undefined): TableOps<SyncCartridge> {
    return {
      table: 'cartridges',
      rows,
      findMeta: (id) => this.prisma.cartridge.findUnique({ where: { id }, select: metaSelect }),
      create: async (r) => {
        await this.prisma.cartridge.create({ data: { ...cartridgeData(r), id: r.id, userId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.cartridge.update({ where: { id: r.id }, data: cartridgeData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.cartridge.findUnique({ where: { id } });
        return row ? wireCartridge(row) : null;
      },
      onUniqueConflict: async (r) => {
        // Same name already exists under a different id: merge into that row (LWW).
        const match = await this.prisma.cartridge.findUnique({
          where: { userId_name: { userId, name: r.name } },
        });
        if (!match) return null;
        if (new Date(r.updatedAt) > match.updatedAt) {
          await this.prisma.cartridge.update({
            where: { id: match.id },
            data: { deletedAt: r.deletedAt ? new Date(r.deletedAt) : null },
          });
        }
        return match.id;
      },
    };
  }

  private gunOps(userId: string, rows: SyncGun[] | undefined): TableOps<SyncGun> {
    return {
      table: 'guns',
      rows,
      findMeta: (id) => this.prisma.gun.findUnique({ where: { id }, select: metaSelect }),
      create: async (r) => {
        await this.prisma.gun.create({ data: { ...gunData(r), id: r.id, userId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.gun.update({ where: { id: r.id }, data: gunData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.gun.findUnique({ where: { id } });
        return row ? wireGun(row) : null;
      },
    };
  }

  private ammoOps(userId: string, rows: SyncAmmo[] | undefined): TableOps<SyncAmmo> {
    return {
      table: 'ammo',
      rows,
      findMeta: (id) => this.prisma.ammo.findUnique({ where: { id }, select: metaSelect }),
      create: async (r) => {
        await this.prisma.ammo.create({ data: { ...ammoData(r), id: r.id, userId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.ammo.update({ where: { id: r.id }, data: ammoData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.ammo.findUnique({ where: { id } });
        return row ? wireAmmo(row) : null;
      },
    };
  }

  private ammoImageOps(userId: string, rows: SyncAmmoImage[] | undefined): TableOps<SyncAmmoImage> {
    return {
      table: 'ammoImages',
      rows,
      findMeta: (id) => this.prisma.ammoImage.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.ammo.findUnique({ where: { id: r.ammoId }, select: { userId: true } }), userId, 'ammo'),
      create: async (r) => {
        await this.prisma.ammoImage.create({ data: { ...ammoImageData(r), id: r.id, userId, ammoId: r.ammoId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.ammoImage.update({ where: { id: r.id }, data: ammoImageData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.ammoImage.findUnique({ where: { id } });
        return row ? wireAmmoImage(row) : null;
      },
    };
  }

  private ammoPriceEntryOps(
    userId: string,
    rows: SyncAmmoPriceEntry[] | undefined,
  ): TableOps<SyncAmmoPriceEntry> {
    return {
      table: 'ammoPriceEntries',
      rows,
      findMeta: (id) => this.prisma.ammoPriceEntry.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.ammo.findUnique({ where: { id: r.ammoId }, select: { userId: true } }), userId, 'ammo'),
      create: async (r) => {
        await this.prisma.ammoPriceEntry.create({ data: { ...ammoPriceEntryData(r), id: r.id, userId, ammoId: r.ammoId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.ammoPriceEntry.update({ where: { id: r.id }, data: ammoPriceEntryData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.ammoPriceEntry.findUnique({ where: { id } });
        return row ? wireAmmoPriceEntry(row) : null;
      },
    };
  }

  private scopeProfileOps(
    userId: string,
    rows: SyncScopeProfile[] | undefined,
  ): TableOps<SyncScopeProfile> {
    return {
      table: 'scopeProfiles',
      rows,
      findMeta: (id) => this.prisma.scopeProfile.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.gun.findUnique({ where: { id: r.gunId }, select: { userId: true } }), userId, 'gun'),
      create: async (r) => {
        await this.prisma.scopeProfile.create({ data: { ...scopeProfileData(r), id: r.id, userId, gunId: r.gunId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.scopeProfile.update({ where: { id: r.id }, data: { ...scopeProfileData(r), gunId: r.gunId } });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.scopeProfile.findUnique({ where: { id } });
        return row ? wireScopeProfile(row) : null;
      },
    };
  }

  private sessionOps(userId: string, rows: SyncSession[] | undefined): TableOps<SyncSession> {
    return {
      table: 'sessions',
      rows,
      findMeta: (id) => this.prisma.session.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: async (r) => {
        const gunProblem = await this.checkOwned(this.prisma.gun.findUnique({ where: { id: r.gunId }, select: { userId: true } }), userId, 'gun');
        if (gunProblem) return gunProblem;
        if (r.ammoId) {
          return this.checkOwned(this.prisma.ammo.findUnique({ where: { id: r.ammoId }, select: { userId: true } }), userId, 'ammo');
        }
        return null;
      },
      create: async (r) => {
        await this.prisma.session.create({ data: { ...sessionData(r), id: r.id, userId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.session.update({ where: { id: r.id }, data: sessionData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.session.findUnique({ where: { id } });
        return row ? wireSession(row) : null;
      },
    };
  }

  private setOps(userId: string, rows: SyncSet[] | undefined): TableOps<SyncSet> {
    return {
      table: 'sets',
      rows,
      findMeta: (id) => this.prisma.shootingSet.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.session.findUnique({ where: { id: r.sessionId }, select: { userId: true } }), userId, 'session'),
      create: async (r) => {
        await this.prisma.shootingSet.create({ data: { ...setData(r), id: r.id, userId, sessionId: r.sessionId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.shootingSet.update({ where: { id: r.id }, data: setData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.shootingSet.findUnique({ where: { id } });
        return row ? wireSet(row) : null;
      },
    };
  }

  private targetOps(userId: string, rows: SyncTarget[] | undefined): TableOps<SyncTarget> {
    return {
      table: 'targets',
      rows,
      findMeta: (id) => this.prisma.target.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.shootingSet.findUnique({ where: { id: r.setId }, select: { userId: true } }), userId, 'set'),
      create: async (r) => {
        await this.prisma.target.create({ data: { ...targetData(r), id: r.id, userId, setId: r.setId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.target.update({ where: { id: r.id }, data: targetData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.target.findUnique({ where: { id } });
        return row ? wireTarget(row) : null;
      },
    };
  }

  private shotOps(userId: string, rows: SyncShot[] | undefined): TableOps<SyncShot> {
    return {
      table: 'shots',
      rows,
      findMeta: (id) => this.prisma.shot.findUnique({ where: { id }, select: metaSelect }),
      parentCheck: (r) => this.checkOwned(this.prisma.target.findUnique({ where: { id: r.targetId }, select: { userId: true } }), userId, 'target'),
      create: async (r) => {
        await this.prisma.shot.create({ data: { ...shotData(r), id: r.id, userId, targetId: r.targetId, createdAt: new Date(r.createdAt) } });
      },
      update: async (r) => {
        await this.prisma.shot.update({ where: { id: r.id }, data: shotData(r) });
      },
      fetchWire: async (id) => {
        const row = await this.prisma.shot.findUnique({ where: { id } });
        return row ? wireShot(row) : null;
      },
    };
  }

  private async checkOwned(
    find: Prisma.PrismaPromise<{ userId: string } | null>,
    userId: string,
    label: string,
  ): Promise<string | null> {
    const parent = await find;
    if (!parent || parent.userId !== userId) return `${label} not found`;
    return null;
  }
}

const metaSelect = { userId: true, updatedAt: true } as const;

// ---- wire mappers (db row → sync row) ----

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
const dateOrNull = (s: string | null): Date | null => (s ? new Date(s) : null);

function wireBase(r: { id: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null }) {
  return {
    id: r.id,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    deletedAt: isoOrNull(r.deletedAt),
  };
}

function wireCartridge(r: Prisma.CartridgeGetPayload<object>): SyncCartridge {
  return { ...wireBase(r), name: r.name };
}
function cartridgeData(r: SyncCartridge) {
  return { name: r.name, deletedAt: dateOrNull(r.deletedAt) };
}

function wireGun(r: Prisma.GunGetPayload<object>): SyncGun {
  return {
    ...wireBase(r),
    name: r.name,
    caliber: r.caliber,
    purchasePrice: r.purchasePrice === null ? null : Number(r.purchasePrice),
    purchaseDate: isoOrNull(r.purchaseDate),
    initialRoundCount: r.initialRoundCount,
    cleaningIntervalRounds: r.cleaningIntervalRounds,
    lastCleanedAtRound: r.lastCleanedAtRound,
    imagePath: r.imagePath,
    notes: r.notes,
  };
}
function gunData(r: SyncGun) {
  return {
    name: r.name,
    caliber: r.caliber,
    purchasePrice: r.purchasePrice,
    purchaseDate: dateOrNull(r.purchaseDate),
    initialRoundCount: r.initialRoundCount,
    cleaningIntervalRounds: r.cleaningIntervalRounds,
    lastCleanedAtRound: r.lastCleanedAtRound,
    imagePath: r.imagePath,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireAmmo(r: Prisma.AmmoGetPayload<object>): SyncAmmo {
  return {
    ...wireBase(r),
    name: r.name,
    caliber: r.caliber,
    bulletWeightG: r.bulletWeightG,
    muzzleVelocityMps: r.muzzleVelocityMps,
    ballisticCoefficient: r.ballisticCoefficient,
    bcModel: r.bcModel,
    notes: r.notes,
  };
}
function ammoData(r: SyncAmmo) {
  return {
    name: r.name,
    caliber: r.caliber,
    bulletWeightG: r.bulletWeightG,
    muzzleVelocityMps: r.muzzleVelocityMps,
    ballisticCoefficient: r.ballisticCoefficient,
    bcModel: r.bcModel,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireAmmoImage(r: Prisma.AmmoImageGetPayload<object>): SyncAmmoImage {
  return { ...wireBase(r), ammoId: r.ammoId, imagePath: r.imagePath };
}
function ammoImageData(r: SyncAmmoImage) {
  return { imagePath: r.imagePath, deletedAt: dateOrNull(r.deletedAt) };
}

function wireAmmoPriceEntry(r: Prisma.AmmoPriceEntryGetPayload<object>): SyncAmmoPriceEntry {
  return {
    ...wireBase(r),
    ammoId: r.ammoId,
    date: iso(r.date),
    pricePerRound: Number(r.pricePerRound),
    currency: r.currency,
    quantity: r.quantity,
    vendor: r.vendor,
    note: r.note,
  };
}
function ammoPriceEntryData(r: SyncAmmoPriceEntry) {
  return {
    date: new Date(r.date),
    pricePerRound: r.pricePerRound,
    currency: r.currency,
    quantity: r.quantity,
    vendor: r.vendor,
    note: r.note,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireScopeProfile(r: Prisma.ScopeProfileGetPayload<object>): SyncScopeProfile {
  return {
    ...wireBase(r),
    gunId: r.gunId,
    name: r.name,
    clickValue: r.clickValue,
    angularUnit: r.angularUnit,
    zeroRangeM: r.zeroRangeM,
    sightHeightMm: r.sightHeightMm,
    notes: r.notes,
  };
}
function scopeProfileData(r: SyncScopeProfile) {
  return {
    name: r.name,
    clickValue: r.clickValue,
    angularUnit: r.angularUnit,
    zeroRangeM: r.zeroRangeM,
    sightHeightMm: r.sightHeightMm,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireSession(r: Prisma.SessionGetPayload<object>): SyncSession {
  return {
    ...wireBase(r),
    gunId: r.gunId,
    ammoId: r.ammoId,
    startedAt: iso(r.startedAt),
    locationName: r.locationName,
    latitude: r.latitude,
    longitude: r.longitude,
    discipline: r.discipline,
    notes: r.notes,
  };
}
function sessionData(r: SyncSession) {
  return {
    gunId: r.gunId,
    ammoId: r.ammoId,
    startedAt: new Date(r.startedAt),
    locationName: r.locationName,
    latitude: r.latitude,
    longitude: r.longitude,
    discipline: r.discipline,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireSet(r: Prisma.ShootingSetGetPayload<object>): SyncSet {
  return {
    ...wireBase(r),
    sessionId: r.sessionId,
    order: r.order,
    distanceM: r.distanceM,
    ipscTimeSeconds: r.ipscTimeSeconds,
    notes: r.notes,
  };
}
function setData(r: SyncSet) {
  return {
    order: r.order,
    distanceM: r.distanceM,
    ipscTimeSeconds: r.ipscTimeSeconds,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireTarget(r: Prisma.TargetGetPayload<object>): SyncTarget {
  return {
    ...wireBase(r),
    setId: r.setId,
    imagePath: r.imagePath,
    shotCount: r.shotCount,
    scoringSystem: r.scoringSystem,
    maxScorePerShot: r.maxScorePerShot,
    status: r.status,
    totalScore: r.totalScore,
    notes: r.notes,
  };
}
function targetData(r: SyncTarget) {
  return {
    imagePath: r.imagePath,
    shotCount: r.shotCount,
    scoringSystem: r.scoringSystem,
    maxScorePerShot: r.maxScorePerShot,
    status: r.status,
    totalScore: r.totalScore,
    notes: r.notes,
    deletedAt: dateOrNull(r.deletedAt),
  };
}

function wireShot(r: Prisma.ShotGetPayload<object>): SyncShot {
  return {
    ...wireBase(r),
    targetId: r.targetId,
    index: r.index,
    ringValue: r.ringValue,
    x: r.x,
    y: r.y,
    zone: r.zone,
    source: r.source,
  };
}
function shotData(r: SyncShot) {
  return {
    index: r.index,
    ringValue: r.ringValue,
    x: r.x,
    y: r.y,
    zone: r.zone,
    source: r.source,
    deletedAt: dateOrNull(r.deletedAt),
  };
}
