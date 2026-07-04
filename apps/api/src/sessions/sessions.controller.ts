import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createSessionSchema,
  createSetSchema,
  createTargetSchema,
  setShotsSchema,
  updateSessionSchema,
  updateTargetSchema,
  type CreateSessionInput,
  type CreateSetInput,
  type CreateTargetInput,
  type SessionDetail,
  type SessionListItem,
  type SetShotsInput,
  type UpdateSessionInput,
  type UpdateTargetInput,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query('gunId') gunId?: string): Promise<SessionListItem[]> {
    return this.sessions.list(user.id, gunId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
  ): Promise<SessionDetail> {
    return this.sessions.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<SessionDetail> {
    return this.sessions.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: UpdateSessionInput,
  ): Promise<SessionDetail> {
    return this.sessions.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.sessions.remove(user.id, id);
    return { ok: true };
  }

  @Post(':id/sets')
  addSet(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSetSchema)) body: CreateSetInput,
  ): Promise<SessionDetail> {
    return this.sessions.addSet(user.id, id, body);
  }

  @Patch(':id/sets/:setId')
  updateSet(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Body(new ZodValidationPipe(createSetSchema)) body: CreateSetInput,
  ): Promise<SessionDetail> {
    return this.sessions.updateSet(user.id, id, setId, body);
  }

  @Delete(':id/sets/:setId')
  removeSet(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
  ): Promise<SessionDetail> {
    return this.sessions.removeSet(user.id, id, setId);
  }

  @Post(':id/sets/:setId/targets')
  addTarget(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Body(new ZodValidationPipe(createTargetSchema)) body: CreateTargetInput,
  ): Promise<SessionDetail> {
    return this.sessions.addTarget(user.id, id, setId, body);
  }

  @Patch(':id/sets/:setId/targets/:targetId')
  updateTarget(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Param('targetId') targetId: string,
    @Body(new ZodValidationPipe(updateTargetSchema)) body: UpdateTargetInput,
  ): Promise<SessionDetail> {
    return this.sessions.updateTarget(user.id, id, setId, targetId, body);
  }

  @Delete(':id/sets/:setId/targets/:targetId')
  removeTarget(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Param('targetId') targetId: string,
  ): Promise<SessionDetail> {
    return this.sessions.removeTarget(user.id, id, setId, targetId);
  }

  @Put(':id/sets/:setId/targets/:targetId/shots')
  setShots(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Param('targetId') targetId: string,
    @Body(new ZodValidationPipe(setShotsSchema)) body: SetShotsInput,
  ): Promise<SessionDetail> {
    return this.sessions.setShots(user.id, id, setId, targetId, body.ringValues);
  }
}
