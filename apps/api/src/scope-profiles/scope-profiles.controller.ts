import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createScopeProfileSchema,
  updateScopeProfileSchema,
  type CreateScopeProfileInput,
  type ScopeProfile,
  type UpdateScopeProfileInput,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { ScopeProfilesService } from './scope-profiles.service';

@Controller('scope-profiles')
@UseGuards(JwtAuthGuard)
export class ScopeProfilesController {
  constructor(private readonly profiles: ScopeProfilesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthedUser,
    @Query('gunId') gunId?: string,
  ): Promise<ScopeProfile[]> {
    return this.profiles.list(user.id, gunId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createScopeProfileSchema)) body: CreateScopeProfileInput,
  ): Promise<ScopeProfile> {
    return this.profiles.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateScopeProfileSchema)) body: UpdateScopeProfileInput,
  ): Promise<ScopeProfile> {
    return this.profiles.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.profiles.remove(user.id, id);
    return { ok: true };
  }
}
