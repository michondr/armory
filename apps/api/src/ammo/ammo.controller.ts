import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createAmmoSchema,
  createPriceEntrySchema,
  updateAmmoSchema,
  updatePriceEntrySchema,
  type Ammo,
  type AmmoSuggestion,
  type CreateAmmoInput,
  type CreatePriceEntryInput,
  type UpdateAmmoInput,
  type UpdatePriceEntryInput,
} from '@armory/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { AmmoService } from './ammo.service';

const attachImageSchema = z.object({ imagePath: z.string().min(1) });

@Controller('ammo')
@UseGuards(JwtAuthGuard)
export class AmmoController {
  constructor(private readonly ammo: AmmoService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query('q') q?: string): Promise<Ammo[]> {
    return this.ammo.list(user.id, q);
  }

  // Static route must precede ':id' so it isn't captured as an id.
  @Get('suggest')
  suggest(@Query('q') q?: string): AmmoSuggestion[] {
    return this.ammo.suggest(q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<Ammo> {
    return this.ammo.get(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createAmmoSchema)) body: CreateAmmoInput,
  ): Promise<Ammo> {
    return this.ammo.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAmmoSchema)) body: UpdateAmmoInput,
  ): Promise<Ammo> {
    return this.ammo.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.ammo.remove(user.id, id);
    return { ok: true };
  }

  @Post(':id/prices')
  addPrice(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createPriceEntrySchema)) body: CreatePriceEntryInput,
  ): Promise<Ammo> {
    return this.ammo.addPriceEntry(user.id, id, body);
  }

  @Patch(':id/prices/:entryId')
  updatePrice(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body(new ZodValidationPipe(updatePriceEntrySchema)) body: UpdatePriceEntryInput,
  ): Promise<Ammo> {
    return this.ammo.updatePriceEntry(user.id, id, entryId, body);
  }

  @Delete(':id/prices/:entryId')
  deletePrice(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ): Promise<Ammo> {
    return this.ammo.deletePriceEntry(user.id, id, entryId);
  }

  @Post(':id/images')
  addImage(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attachImageSchema)) body: { imagePath: string },
  ): Promise<Ammo> {
    return this.ammo.addImage(user.id, id, body.imagePath);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ): Promise<Ammo> {
    return this.ammo.removeImage(user.id, id, imageId);
  }
}
