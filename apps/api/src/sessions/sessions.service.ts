import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeShotStats,
  zonePoints,
  type CreateSessionInput,
  type CreateSetInput,
  type CreateTargetInput,
  type Point,
  type SessionDetail,
  type SessionListItem,
  type SetDto,
  type SetShotsInput,
  type ShotStats,
  type TargetDto,
  type UpdateSessionInput,
  type UpdateTargetInput,
} from '@armory/shared';
import { PrismaService } from '../prisma/prisma.service';

const detailInclude = {
  gun: true,
  ammo: true,
  sets: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      targets: {
        orderBy: { createdAt: 'asc' },
        include: { shots: { orderBy: { index: 'asc' } } },
      },
    },
  },
} satisfies Prisma.SessionInclude;

type SessionWithAll = Prisma.SessionGetPayload<{ include: typeof detailInclude }>;
type ShotRow = SessionWithAll['sets'][number]['targets'][number]['shots'][number];

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, gunId?: string): Promise<SessionListItem[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, deletedAt: null, ...(gunId ? { gunId } : {}) },
      include: detailInclude,
      orderBy: { startedAt: 'desc' },
    });
    return sessions.map((s) => {
      const shots = s.sets.flatMap((set) => set.targets.flatMap((t) => t.shots));
      const targetCount = s.sets.reduce((n, set) => n + set.targets.length, 0);
      return {
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        locationName: s.locationName,
        discipline: s.discipline,
        gun: gunSummary(s.gun),
        ammoName: s.ammo?.name ?? null,
        targetCount,
        stats: statsFromShots(shots),
      };
    });
  }

  async get(userId: string, id: string): Promise<SessionDetail> {
    const session = await this.prisma.session.findFirst({
      where: { id, userId, deletedAt: null },
      include: detailInclude,
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.toDetail(session);
  }

  async create(userId: string, input: CreateSessionInput): Promise<SessionDetail> {
    await this.assertGun(userId, input.gunId);
    if (input.ammoId) await this.assertAmmo(userId, input.ammoId);

    const session = await this.prisma.session.create({
      data: {
        userId,
        gunId: input.gunId,
        ammoId: input.ammoId ?? null,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        locationName: input.locationName ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        discipline: input.discipline ?? 'SHORT',
        notes: input.notes ?? null,
      },
      include: detailInclude,
    });
    return this.toDetail(session);
  }

  async update(userId: string, id: string, input: UpdateSessionInput): Promise<SessionDetail> {
    await this.ensureSession(userId, id);
    if (input.gunId) await this.assertGun(userId, input.gunId);
    if (input.ammoId) await this.assertAmmo(userId, input.ammoId);

    await this.prisma.session.update({
      where: { id },
      data: {
        gunId: input.gunId,
        ammoId: input.ammoId,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        locationName: input.locationName,
        latitude: input.latitude,
        longitude: input.longitude,
        discipline: input.discipline,
        notes: input.notes,
      },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ensureSession(userId, id);
    await this.prisma.session.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ---- sets ----

  async addSet(userId: string, sessionId: string, input: CreateSetInput): Promise<SessionDetail> {
    await this.ensureSession(userId, sessionId);
    const count = await this.prisma.shootingSet.count({ where: { sessionId } });
    await this.prisma.shootingSet.create({
      data: {
        sessionId,
        order: input.order ?? count,
        distanceM: input.distanceM ?? null,
        ipscTimeSeconds: input.ipscTimeSeconds ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.get(userId, sessionId);
  }

  async updateSet(
    userId: string,
    sessionId: string,
    setId: string,
    input: CreateSetInput,
  ): Promise<SessionDetail> {
    await this.ensureSet(userId, sessionId, setId);
    await this.prisma.shootingSet.update({
      where: { id: setId },
      data: {
        order: input.order,
        distanceM: input.distanceM,
        ipscTimeSeconds: input.ipscTimeSeconds,
        notes: input.notes,
      },
    });
    return this.get(userId, sessionId);
  }

  async removeSet(userId: string, sessionId: string, setId: string): Promise<SessionDetail> {
    await this.ensureSet(userId, sessionId, setId);
    await this.prisma.shootingSet.delete({ where: { id: setId } });
    return this.get(userId, sessionId);
  }

  // ---- targets ----

  async addTarget(
    userId: string,
    sessionId: string,
    setId: string,
    input: CreateTargetInput,
  ): Promise<SessionDetail> {
    await this.ensureSet(userId, sessionId, setId);
    await this.prisma.target.create({
      data: {
        setId,
        shotCount: input.shotCount ?? 0,
        scoringSystem: input.scoringSystem ?? 'RINGS',
        maxScorePerShot: input.maxScorePerShot ?? null,
        imagePath: input.imagePath ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.get(userId, sessionId);
  }

  async updateTarget(
    userId: string,
    sessionId: string,
    setId: string,
    targetId: string,
    input: UpdateTargetInput,
  ): Promise<SessionDetail> {
    await this.ensureTarget(userId, sessionId, setId, targetId);
    await this.prisma.target.update({
      where: { id: targetId },
      data: {
        shotCount: input.shotCount,
        scoringSystem: input.scoringSystem,
        maxScorePerShot: input.maxScorePerShot,
        imagePath: input.imagePath,
        notes: input.notes,
      },
    });
    return this.get(userId, sessionId);
  }

  async removeTarget(
    userId: string,
    sessionId: string,
    setId: string,
    targetId: string,
  ): Promise<SessionDetail> {
    await this.ensureTarget(userId, sessionId, setId, targetId);
    await this.prisma.target.delete({ where: { id: targetId } });
    return this.get(userId, sessionId);
  }

  /** Manual scoring: replace the target's shots with ring values (RINGS) or zones (IPSC). */
  async setShots(
    userId: string,
    sessionId: string,
    setId: string,
    targetId: string,
    input: SetShotsInput,
  ): Promise<SessionDetail> {
    await this.ensureTarget(userId, sessionId, setId, targetId);

    // IPSC zones store the zone letter + its point value; rings store the value.
    const shots: { ringValue: number | null; zone: string | null }[] = input.zones?.length
      ? input.zones.map((z) => ({ zone: z.toUpperCase(), ringValue: zonePoints(z) }))
      : (input.ringValues ?? []).map((v) => ({ ringValue: v, zone: null }));

    const totalScore = shots.reduce((sum, s) => sum + (s.ringValue ?? 0), 0);

    await this.prisma.$transaction([
      this.prisma.shot.deleteMany({ where: { targetId } }),
      ...(shots.length
        ? [
            this.prisma.shot.createMany({
              data: shots.map((s, i) => ({
                targetId,
                index: i,
                ringValue: s.ringValue,
                zone: s.zone,
                source: 'MANUAL' as const,
              })),
            }),
          ]
        : []),
      this.prisma.target.update({
        where: { id: targetId },
        data: {
          totalScore: shots.length ? totalScore : null,
          status: 'MANUAL',
          ...(shots.length ? { shotCount: shots.length } : {}),
        },
      }),
    ]);
    return this.get(userId, sessionId);
  }

  // ---- helpers ----

  private async assertGun(userId: string, gunId: string): Promise<void> {
    const gun = await this.prisma.gun.findFirst({ where: { id: gunId, userId, deletedAt: null } });
    if (!gun) throw new BadRequestException('Gun not found');
  }

  private async assertAmmo(userId: string, ammoId: string): Promise<void> {
    const ammo = await this.prisma.ammo.findFirst({
      where: { id: ammoId, userId, deletedAt: null },
    });
    if (!ammo) throw new BadRequestException('Ammo not found');
  }

  private async ensureSession(userId: string, id: string): Promise<void> {
    const s = await this.prisma.session.findFirst({ where: { id, userId, deletedAt: null } });
    if (!s) throw new NotFoundException('Session not found');
  }

  private async ensureSet(userId: string, sessionId: string, setId: string): Promise<void> {
    await this.ensureSession(userId, sessionId);
    const set = await this.prisma.shootingSet.findFirst({ where: { id: setId, sessionId } });
    if (!set) throw new NotFoundException('Set not found');
  }

  private async ensureTarget(
    userId: string,
    sessionId: string,
    setId: string,
    targetId: string,
  ): Promise<void> {
    await this.ensureSet(userId, sessionId, setId);
    const target = await this.prisma.target.findFirst({ where: { id: targetId, setId } });
    if (!target) throw new NotFoundException('Target not found');
  }

  private toDetail(s: SessionWithAll): SessionDetail {
    const sets: SetDto[] = s.sets.map((set) => {
      const targets: TargetDto[] = set.targets.map((t) => ({
        id: t.id,
        imagePath: t.imagePath,
        shotCount: t.shotCount,
        scoringSystem: t.scoringSystem,
        maxScorePerShot: t.maxScorePerShot,
        status: t.status,
        totalScore: t.totalScore,
        notes: t.notes,
        shots: t.shots.map((sh) => ({
          id: sh.id,
          index: sh.index,
          ringValue: sh.ringValue,
          x: sh.x,
          y: sh.y,
          zone: sh.zone,
          source: sh.source,
        })),
        stats: statsFromShots(t.shots),
      }));
      return {
        id: set.id,
        order: set.order,
        distanceM: set.distanceM,
        ipscTimeSeconds: set.ipscTimeSeconds,
        notes: set.notes,
        targets,
        stats: statsFromShots(set.targets.flatMap((t) => t.shots)),
      };
    });

    return {
      id: s.id,
      startedAt: s.startedAt.toISOString(),
      locationName: s.locationName,
      latitude: s.latitude,
      longitude: s.longitude,
      discipline: s.discipline,
      notes: s.notes,
      gun: gunSummary(s.gun),
      ammo: s.ammo ? { id: s.ammo.id, name: s.ammo.name } : null,
      sets,
      stats: statsFromShots(s.sets.flatMap((set) => set.targets.flatMap((t) => t.shots))),
      createdAt: s.createdAt.toISOString(),
    };
  }
}

function statsFromShots(shots: ShotRow[]): ShotStats {
  const scores = shots
    .map((sh) => sh.ringValue)
    .filter((v): v is number => v !== null && v !== undefined);
  const positions: Point[] = shots
    .filter((sh) => sh.x !== null && sh.y !== null)
    .map((sh) => ({ x: sh.x as number, y: sh.y as number }));
  return computeShotStats(scores, positions.length >= 2 ? positions : undefined);
}

function gunSummary(gun: { id: string; name: string; caliber: string | null; imagePath: string | null }) {
  return { id: gun.id, name: gun.name, caliber: gun.caliber, imagePath: gun.imagePath };
}
