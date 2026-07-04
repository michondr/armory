import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@armory/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard, type AuthedUser } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
  ): Promise<{ ok: true }> {
    await this.auth.logout(body.refreshToken);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthedUser): AuthedUser {
    return user;
  }
}
