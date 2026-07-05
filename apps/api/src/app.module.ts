import { Module } from '@nestjs/common';
import { AmmoModule } from './ammo/ammo.module';
import { AuthModule } from './auth/auth.module';
import { CartridgesModule } from './cartridges/cartridges.module';
import { EnvModule } from './config/env.module';
import { GunsModule } from './guns/guns.module';
import { HealthController } from './health/health.controller';
import { ImagesModule } from './images/images.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScoringModule } from './scoring/scoring.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ImagesModule,
    GunsModule,
    AmmoModule,
    SessionsModule,
    CartridgesModule,
    ScoringModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
