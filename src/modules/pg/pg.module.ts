/** PG module: lets an owner manage their property listing. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PgController } from './controllers/pg.controller';
import { PublicPgController } from './controllers/public-pg.controller';
import { RoomsController } from './controllers/rooms.controller';
import { OwnerVisitsController } from '../visits/controllers/visits.controller';
import { VisitsModule } from '../visits/visits.module';
import { PgService } from './services/pg.service';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [DatabaseModule, AuthModule, UploadsModule, VisitsModule],
  controllers: [
    PgController,
    PublicPgController,
    RoomsController,
    OwnerVisitsController,
  ],
  providers: [PgService, RoomsService],
})
export class PgModule {}
