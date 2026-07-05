import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  createCartridgeSchema,
  type Cartridge,
  type CreateCartridgeInput,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { CartridgesService } from './cartridges.service';

@Controller('cartridges')
@UseGuards(JwtAuthGuard)
export class CartridgesController {
  constructor(private readonly cartridges: CartridgesService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser): Promise<Cartridge[]> {
    return this.cartridges.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(createCartridgeSchema)) body: CreateCartridgeInput,
  ): Promise<Cartridge> {
    return this.cartridges.create(user.id, body);
  }

  @Post('defaults')
  addDefaults(@CurrentUser() user: AuthedUser): Promise<Cartridge[]> {
    return this.cartridges.addDefaults(user.id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<{ ok: true }> {
    await this.cartridges.remove(user.id, id);
    return { ok: true };
  }
}
