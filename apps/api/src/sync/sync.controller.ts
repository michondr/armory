import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  syncPushSchema,
  type SyncPullResponse,
  type SyncPushInput,
  type SyncPushResponse,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Pull all rows changed since the cursor (omit `since` for a full initial sync). */
  @Get('changes')
  pull(
    @CurrentUser() user: AuthedUser,
    @Query('since') since?: string,
  ): Promise<SyncPullResponse> {
    return this.sync.pull(user.id, since);
  }

  /** Push locally-changed rows; returns authoritative rows + a fresh cursor. */
  @Post('changes')
  push(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(syncPushSchema)) body: SyncPushInput,
  ): Promise<SyncPushResponse> {
    return this.sync.push(user.id, body);
  }
}
