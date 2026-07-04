import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
  type UserSettings,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthedUser): Promise<UserSettings> {
    return this.users.getSettings(user.id);
  }

  @Patch()
  updateSettings(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput,
  ): Promise<UserSettings> {
    return this.users.updateSettings(user.id, body);
  }
}
