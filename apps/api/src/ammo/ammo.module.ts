import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImagesModule } from '../images/images.module';
import { AmmoController } from './ammo.controller';
import { AmmoService } from './ammo.service';

@Module({
  imports: [AuthModule, ImagesModule],
  controllers: [AmmoController],
  providers: [AmmoService],
})
export class AmmoModule {}
