import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import type { UpdateSettingsInput, UserSettings } from '@armory/shared';
import { encryptSecret } from '../common/crypto.util';
import { EnvService } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async getSettings(userId: string): Promise<UserSettings> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toSettings(user);
  }

  async updateSettings(userId: string, input: UpdateSettingsInput): Promise<UserSettings> {
    const data: Prisma.UserUpdateInput = {};
    if (input.unitSystem !== undefined) data.unitSystem = input.unitSystem;
    if (input.angularUnit !== undefined) data.angularUnit = input.angularUnit;
    if (input.smtpHost !== undefined) data.smtpHost = input.smtpHost;
    if (input.smtpPort !== undefined) data.smtpPort = input.smtpPort;
    if (input.smtpUser !== undefined) data.smtpUser = input.smtpUser;
    if (input.smtpFrom !== undefined) data.smtpFrom = input.smtpFrom;
    if (input.smtpPass !== undefined) {
      // write-only: encrypt when set, clear when explicitly null
      data.smtpPassEnc =
        input.smtpPass === null
          ? null
          : encryptSecret(input.smtpPass, this.env.values.APP_ENCRYPTION_KEY);
    }

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.toSettings(user);
  }

  private toSettings(user: User): UserSettings {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      unitSystem: user.unitSystem,
      angularUnit: user.angularUnit,
      smtpHost: user.smtpHost,
      smtpPort: user.smtpPort,
      smtpUser: user.smtpUser,
      smtpFrom: user.smtpFrom,
      smtpPassSet: user.smtpPassEnc !== null,
    };
  }
}
