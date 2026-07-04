import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImagesModule } from '../images/images.module';
import { GunsController } from './guns.controller';
import { GunsService } from './guns.service';

@Module({
  imports: [AuthModule, ImagesModule],
  controllers: [GunsController],
  providers: [GunsService],
})
export class GunsModule {}
