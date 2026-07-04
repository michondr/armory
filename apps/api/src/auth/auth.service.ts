import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthResponse, LoginInput, RegisterInput } from '@armory/shared';
import { EnvService } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly env: EnvService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName ?? null },
    });
    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  /** Rotate: consume the presented refresh token and issue a fresh pair. */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.env.values.JWT_ACCESS_SECRET,
        expiresIn: this.env.values.JWT_ACCESS_TTL,
      },
    );

    // Opaque refresh token: random string, only its hash is persisted.
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.env.values.JWT_REFRESH_TTL * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
