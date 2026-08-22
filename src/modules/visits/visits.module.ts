/** Visits module: customers booking a look around a PG. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { VisitsController } from './controllers/visits.controller';
import { VisitsService } from './services/visits.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
