import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EnvModule } from './config/env.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [EnvModule, PrismaModule, AuthModule, UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
