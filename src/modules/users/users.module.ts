import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MeController } from './controllers/me.controller';
import { UsersController } from './controllers/users.controller';
import { AccountLifecycleService } from './services/account-lifecycle.service';
import { MeService } from './services/me.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [DatabaseModule, AuthModule, UploadsModule],
  // MeController is declared first so `/v1/users/me` is matched before the
  // Super Admin listing at `/v1/users`.
  controllers: [MeController, UsersController],
  providers: [AccountLifecycleService, MeService, UsersService],
})
export class UsersModule {}
