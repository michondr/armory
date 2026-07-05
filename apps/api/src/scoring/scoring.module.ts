import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImagesModule } from '../images/images.module';
import { ScoringController } from './scoring.controller';

@Module({
  imports: [AuthModule, ImagesModule],
  controllers: [ScoringController],
})
export class ScoringModule {}
