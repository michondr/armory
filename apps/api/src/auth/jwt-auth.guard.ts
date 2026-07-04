import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { EnvService } from '../config/env';

export interface AuthedUser {
  id: string;
  email: string;
}

interface AccessPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.env.values.JWT_ACCESS_SECRET,
      });
      req.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
