import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScopeProfilesController } from './scope-profiles.controller';
import { ScopeProfilesService } from './scope-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [ScopeProfilesController],
  providers: [ScopeProfilesService],
})
export class ScopeProfilesModule {}
