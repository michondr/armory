import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ScopeProfile as PrismaScopeProfile } from '@prisma/client';
import type {
  CreateScopeProfileInput,
  ScopeProfile,
  UpdateScopeProfileInput,
} from '@armory/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScopeProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, gunId?: string): Promise<ScopeProfile[]> {
    const rows = await this.prisma.scopeProfile.findMany({
      where: { userId, deletedAt: null, ...(gunId ? { gunId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(userId: string, input: CreateScopeProfileInput): Promise<ScopeProfile> {
    await this.assertGun(userId, input.gunId);
    const row = await this.prisma.scopeProfile.create({
      data: {
        userId,
        gunId: input.gunId,
        name: input.name,
        clickValue: input.clickValue,
        angularUnit: input.angularUnit,
        zeroRangeM: input.zeroRangeM,
        sightHeightMm: input.sightHeightMm,
        notes: input.notes ?? null,
      },
    });
    return toDto(row);
  }

  async update(userId: string, id: string, input: UpdateScopeProfileInput): Promise<ScopeProfile> {
    await this.findOwned(userId, id);
    if (input.gunId) await this.assertGun(userId, input.gunId);
    const row = await this.prisma.scopeProfile.update({
      where: { id },
      data: {
        gunId: input.gunId,
        name: input.name,
        clickValue: input.clickValue,
        angularUnit: input.angularUnit,
        zeroRangeM: input.zeroRangeM,
        sightHeightMm: input.sightHeightMm,
        notes: input.notes,
      },
    });
    return toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.scopeProfile.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findOwned(userId: string, id: string): Promise<PrismaScopeProfile> {
    const row = await this.prisma.scopeProfile.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Scope profile not found');
    return row;
  }

  private async assertGun(userId: string, gunId: string): Promise<void> {
    const gun = await this.prisma.gun.findFirst({ where: { id: gunId, userId, deletedAt: null } });
    if (!gun) throw new BadRequestException('Gun not found');
  }
}

function toDto(r: PrismaScopeProfile): ScopeProfile {
  return {
    id: r.id,
    gunId: r.gunId,
    name: r.name,
    clickValue: r.clickValue,
    angularUnit: r.angularUnit,
    zeroRangeM: r.zeroRangeM,
    sightHeightMm: r.sightHeightMm,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
