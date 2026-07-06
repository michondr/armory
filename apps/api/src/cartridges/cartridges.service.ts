import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Cartridge, CreateCartridgeInput } from '@armory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CARTRIDGES } from './default-cartridges';

@Injectable()
export class CartridgesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Cartridge[]> {
    const rows = await this.prisma.cartridge.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map((c) => ({ id: c.id, name: c.name }));
  }

  async create(userId: string, input: CreateCartridgeInput): Promise<Cartridge> {
    const name = input.name.trim();
    const existing = await this.prisma.cartridge.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing && !existing.deletedAt) throw new ConflictException('Cartridge already exists');
    // (userId, name) is unique across tombstones too, so re-adding revives the old row.
    if (existing) {
      const c = await this.prisma.cartridge.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      return { id: c.id, name: c.name };
    }
    const c = await this.prisma.cartridge.create({ data: { userId, name } });
    return { id: c.id, name: c.name };
  }

  async remove(userId: string, id: string): Promise<void> {
    const c = await this.prisma.cartridge.findFirst({ where: { id, userId, deletedAt: null } });
    if (!c) throw new NotFoundException('Cartridge not found');
    await this.prisma.cartridge.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Add the default set + any calibers already used by the user's guns/ammo. */
  async addDefaults(userId: string): Promise<Cartridge[]> {
    await this.prisma.cartridge.createMany({
      data: DEFAULT_CARTRIDGES.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
    await this.importExistingCalibers(userId);
    return this.list(userId);
  }

  /** Pull distinct caliber strings off the user's guns + ammo into the list. */
  async importExistingCalibers(userId: string): Promise<void> {
    const [guns, ammo] = await Promise.all([
      this.prisma.gun.findMany({
        where: { userId, deletedAt: null, NOT: { caliber: null } },
        select: { caliber: true },
      }),
      this.prisma.ammo.findMany({
        where: { userId, deletedAt: null, NOT: { caliber: null } },
        select: { caliber: true },
      }),
    ]);
    const names = [
      ...new Set(
        [...guns, ...ammo].map((x) => x.caliber?.trim()).filter((s): s is string => !!s),
      ),
    ];
    if (names.length) {
      await this.prisma.cartridge.createMany({
        data: names.map((name) => ({ userId, name })),
        skipDuplicates: true,
      });
    }
  }
}
