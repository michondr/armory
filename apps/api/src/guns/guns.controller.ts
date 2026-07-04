import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createGunSchema,
  updateGunSchema,
  type CreateGunInput,
  type Gun,
  type UpdateGunInput,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { GunsService } from './guns.service';

@Controller('guns')
@UseGuards(JwtAuthGuard)
export class GunsController {
  constructor(private readonly guns: GunsService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<Gun[]> {
    return this.guns.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<Gun> {
    return this.guns.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createGunSchema)) body: CreateGunInput,
  ): Promise<Gun> {
    return this.guns.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGunSchema)) body: UpdateGunInput,
  ): Promise<Gun> {
    return this.guns.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.guns.remove(user.id, id);
    return { ok: true };
  }
}
