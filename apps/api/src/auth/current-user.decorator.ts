import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthedUser } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthedUser }>();
    return req.user;
  },
);
