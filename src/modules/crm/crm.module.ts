/** CRM module: guests staying in a PG, and the rent they pay. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CrmController } from './controllers/crm.controller';
import { CrmService } from './services/crm.service';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CrmController],
  providers: [CrmService, PaymentsService],
})
export class CrmModule {}
