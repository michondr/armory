import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartridgesController } from './cartridges.controller';
import { CartridgesService } from './cartridges.service';

@Module({
  imports: [AuthModule],
  controllers: [CartridgesController],
  providers: [CartridgesService],
})
export class CartridgesModule {}
