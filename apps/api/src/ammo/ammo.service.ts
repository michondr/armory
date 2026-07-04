import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Ammo,
  AmmoSuggestion,
  CreateAmmoInput,
  CreatePriceEntryInput,
  UpdateAmmoInput,
} from '@armory/shared';
import { ImagesService } from '../images/images.service';
import { PrismaService } from '../prisma/prisma.service';
import { AMMO_SEED } from './ammo-seed';

const withRelations = {
  images: { orderBy: { createdAt: 'asc' } },
  priceEntries: { orderBy: { date: 'desc' } },
} satisfies Prisma.AmmoInclude;

type AmmoWithRelations = Prisma.AmmoGetPayload<{ include: typeof withRelations }>;

@Injectable()
export class AmmoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImagesService,
  ) {}

  async list(userId: string, query?: string): Promise<Ammo[]> {
    const q = query?.trim();
    const rows = await this.prisma.ammo.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { caliber: { contains: q, mode: 'insensitive' } },
                { notes: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: withRelations,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async get(userId: string, id: string): Promise<Ammo> {
    const row = await this.findOwned(userId, id);
    return this.toDto(row);
  }

  async create(userId: string, input: CreateAmmoInput): Promise<Ammo> {
    const row = await this.prisma.ammo.create({
      data: {
        userId,
        name: input.name,
        caliber: input.caliber ?? null,
        bulletWeightG: input.bulletWeightG ?? null,
        muzzleVelocityMps: input.muzzleVelocityMps ?? null,
        ballisticCoefficient: input.ballisticCoefficient ?? null,
        bcModel: input.bcModel ?? null,
        notes: input.notes ?? null,
      },
      include: withRelations,
    });
    return this.toDto(row);
  }

  async update(userId: string, id: string, input: UpdateAmmoInput): Promise<Ammo> {
    await this.findOwned(userId, id);
    const row = await this.prisma.ammo.update({
      where: { id },
      data: {
        name: input.name,
        caliber: input.caliber,
        bulletWeightG: input.bulletWeightG,
        muzzleVelocityMps: input.muzzleVelocityMps,
        ballisticCoefficient: input.ballisticCoefficient,
        bcModel: input.bcModel,
        notes: input.notes,
      },
      include: withRelations,
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.findOwned(userId, id);
    await this.prisma.ammo.update({ where: { id }, data: { deletedAt: new Date() } });
    await Promise.all(row.images.map((img) => this.images.remove(userId, img.imagePath)));
  }

  async addPriceEntry(userId: string, ammoId: string, input: CreatePriceEntryInput): Promise<Ammo> {
    await this.findOwned(userId, ammoId);
    await this.prisma.ammoPriceEntry.create({
      data: {
        ammoId,
        date: new Date(input.date),
        pricePerRound: input.pricePerRound,
        currency: input.currency ?? 'CZK',
        quantity: input.quantity ?? 1,
        vendor: input.vendor ?? null,
        note: input.note ?? null,
      },
    });
    return this.get(userId, ammoId);
  }

  async deletePriceEntry(userId: string, ammoId: string, entryId: string): Promise<Ammo> {
    await this.findOwned(userId, ammoId);
    const deleted = await this.prisma.ammoPriceEntry.deleteMany({
      where: { id: entryId, ammoId },
    });
    if (deleted.count === 0) throw new NotFoundException('Price entry not found');
    return this.get(userId, ammoId);
  }

  async addImage(userId: string, ammoId: string, imagePath: string): Promise<Ammo> {
    await this.findOwned(userId, ammoId);
    await this.prisma.ammoImage.create({ data: { ammoId, imagePath } });
    return this.get(userId, ammoId);
  }

  async removeImage(userId: string, ammoId: string, imageId: string): Promise<Ammo> {
    await this.findOwned(userId, ammoId);
    const img = await this.prisma.ammoImage.findFirst({ where: { id: imageId, ammoId } });
    if (!img) throw new NotFoundException('Image not found');
    await this.prisma.ammoImage.delete({ where: { id: imageId } });
    await this.images.remove(userId, img.imagePath);
    return this.get(userId, ammoId);
  }

  suggest(query?: string): AmmoSuggestion[] {
    const q = query?.trim().toLowerCase();
    const matches = q
      ? AMMO_SEED.filter(
          (s) => s.name.toLowerCase().includes(q) || s.caliber.toLowerCase().includes(q),
        )
      : AMMO_SEED;
    return matches.slice(0, 10);
  }

  private async findOwned(userId: string, id: string): Promise<AmmoWithRelations> {
    const row = await this.prisma.ammo.findFirst({
      where: { id, userId, deletedAt: null },
      include: withRelations,
    });
    if (!row) throw new NotFoundException('Ammo not found');
    return row;
  }

  private toDto(a: AmmoWithRelations): Ammo {
    const priceEntries = a.priceEntries.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      pricePerRound: Number(p.pricePerRound),
      currency: p.currency,
      quantity: p.quantity,
      vendor: p.vendor,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    }));
    // priceEntries come back date-desc, so [0] is the most recent purchase.
    const lastPricePerRound = priceEntries.length > 0 ? priceEntries[0]!.pricePerRound : null;
    const roundsPurchased = priceEntries.reduce((sum, p) => sum + p.quantity, 0);

    return {
      id: a.id,
      name: a.name,
      caliber: a.caliber,
      bulletWeightG: a.bulletWeightG,
      muzzleVelocityMps: a.muzzleVelocityMps,
      ballisticCoefficient: a.ballisticCoefficient,
      bcModel: a.bcModel,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      images: a.images.map((img) => ({
        id: img.id,
        imagePath: img.imagePath,
        createdAt: img.createdAt.toISOString(),
      })),
      priceEntries,
      lastPricePerRound,
      roundsPurchased,
    };
  }
}
