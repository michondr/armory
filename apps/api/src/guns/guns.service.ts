import { Injectable, NotFoundException } from '@nestjs/common';
import { Gun as PrismaGun } from '@prisma/client';
import type { CreateGunInput, Gun, UpdateGunInput } from '@armory/shared';
import { ImagesService } from '../images/images.service';
import { PrismaService } from '../prisma/prisma.service';

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
    return guns.map((g) => this.toDto(g));
  }

  async get(userId: string, id: string): Promise<Gun> {
    const gun = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!gun) throw new NotFoundException('Gun not found');
    return this.toDto(gun);
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
    return this.toDto(gun);
  }

  async update(userId: string, id: string, input: UpdateGunInput): Promise<Gun> {
    const existing = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Gun not found');

    // If the image is being replaced or cleared, delete the old file.
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
    return this.toDto(gun);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.gun.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Gun not found');
    await this.prisma.gun.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.images.remove(userId, existing.imagePath);
  }

  private toDto(g: PrismaGun): Gun {
    // Rounds fired = initial count + rounds logged in sessions (Phase 2). No sessions yet → 0.
    const sessionRounds = 0;
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
    };
  }
}
