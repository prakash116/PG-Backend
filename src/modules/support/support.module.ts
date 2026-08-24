/** Support module: queries a PG owner raises and a Super Admin answers. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  AdminSupportController,
  OwnerSupportController,
} from './controllers/support.controller';
import { SupportService } from './services/support.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  // The owner controller is declared first so `/v1/support/me` is matched
  // before the admin's `/v1/support/:id`.
  controllers: [OwnerSupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
