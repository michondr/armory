import { Injectable, NotFoundException } from '@nestjs/common';
import { Gun as PrismaGun } from '@prisma/client';
import type { CreateGunInput, Gun, UpdateGunInput } from '@armory/shared';
import { ImagesService } from '../images/images.service';
import { PrismaService } from '../prisma/prisma.service';

interface GunUsage {
  rounds: number;
  lastShotAt: Date | null;
}

@Injectable()
export class GunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
  ) {}

  async list(userId: string): Promise<Gun[]> {
    const guns = await this.prisma.gun.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const usage = await this.usageByGun(userId);
    return guns
      .map((g) => this.toDto(g, usage.get(g.id)))
      .sort((a, b) => {
        // Most recently shot first; guns never shot fall to the bottom.
        const at = a.lastShotAt ? Date.parse(a.lastShotAt) : 0;
        const bt = b.lastShotAt ? Date.parse(b.lastShotAt) : 0;
        if (bt !== at) return bt - at;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }

  async get(userId: string, id: string): Promise<Gun> {
    const gun = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!gun) throw new NotFoundException('Gun not found');
    const usage = await this.usageByGun(userId, id);
    return this.toDto(gun, usage.get(id));
  }

  async create(userId: string, input: CreateGunInput): Promise<Gun> {
    const gun = await this.prisma.gun.create({
      data: {
        userId,
        name: input.name,
        caliber: input.caliber ?? null,
        purchasePrice: input.purchasePrice ?? null,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        initialRoundCount: input.initialRoundCount ?? 0,
        cleaningIntervalRounds: input.cleaningIntervalRounds ?? null,
        lastCleanedAtRound: input.lastCleanedAtRound ?? 0,
        imagePath: input.imagePath ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.toDto(gun, undefined);
  }

  async update(userId: string, id: string, input: UpdateGunInput): Promise<Gun> {
    const existing = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Gun not found');

    if (input.imagePath !== undefined && existing.imagePath && input.imagePath !== existing.imagePath) {
      await this.images.remove(userId, existing.imagePath);
    }

    const gun = await this.prisma.gun.update({
      where: { id },
      data: {
        name: input.name,
        caliber: input.caliber,
        purchasePrice: input.purchasePrice,
        purchaseDate:
          input.purchaseDate === undefined
            ? undefined
            : input.purchaseDate === null
              ? null
              : new Date(input.purchaseDate),
        initialRoundCount: input.initialRoundCount,
        cleaningIntervalRounds: input.cleaningIntervalRounds,
        lastCleanedAtRound: input.lastCleanedAtRound,
        imagePath: input.imagePath,
        notes: input.notes,
      },
    });
    const usage = await this.usageByGun(userId, id);
    return this.toDto(gun, usage.get(id));
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Gun not found');
    await this.prisma.gun.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.images.remove(userId, existing.imagePath);
  }

  /** Rounds fired (sum of target shot counts) + last session date, per gun. */
  private async usageByGun(userId: string, gunId?: string): Promise<Map<string, GunUsage>> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, deletedAt: null, ...(gunId ? { gunId } : {}) },
      select: {
        gunId: true,
        startedAt: true,
        sets: { select: { targets: { select: { shotCount: true } } } },
      },
    });
    const map = new Map<string, GunUsage>();
    for (const s of sessions) {
      const rounds = s.sets.reduce(
        (n, set) => n + set.targets.reduce((m, t) => m + t.shotCount, 0),
        0,
      );
      const cur = map.get(s.gunId) ?? { rounds: 0, lastShotAt: null };
      cur.rounds += rounds;
      if (!cur.lastShotAt || s.startedAt > cur.lastShotAt) cur.lastShotAt = s.startedAt;
      map.set(s.gunId, cur);
    }
    return map;
  }

  private toDto(g: PrismaGun, usage: GunUsage | undefined): Gun {
    const sessionRounds = usage?.rounds ?? 0;
    const roundsFired = g.initialRoundCount + sessionRounds;
    const roundsSinceCleaning = Math.max(0, roundsFired - g.lastCleanedAtRound);
    const cleaningDue =
      g.cleaningIntervalRounds != null && roundsSinceCleaning >= g.cleaningIntervalRounds;

    return {
      id: g.id,
      name: g.name,
      caliber: g.caliber,
      purchasePrice: g.purchasePrice === null ? null : Number(g.purchasePrice),
      purchaseDate: g.purchaseDate ? g.purchaseDate.toISOString() : null,
      initialRoundCount: g.initialRoundCount,
      cleaningIntervalRounds: g.cleaningIntervalRounds,
      lastCleanedAtRound: g.lastCleanedAtRound,
      imagePath: g.imagePath,
      notes: g.notes,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      roundsFired,
      roundsSinceCleaning,
      cleaningDue,
      lastShotAt: usage?.lastShotAt ? usage.lastShotAt.toISOString() : null,
    };
  }
}
