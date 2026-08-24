/** PG module: lets an owner manage their property listing. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminPgController } from './controllers/admin-pg.controller';
import { PgController } from './controllers/pg.controller';
import { PublicPgController } from './controllers/public-pg.controller';
import { PublishingController } from './controllers/publishing.controller';
import { RoomsController } from './controllers/rooms.controller';
import { OwnerVisitsController } from '../visits/controllers/visits.controller';
import { VisitsModule } from '../visits/visits.module';
import { AdminPgService } from './services/admin-pg.service';
import { PgService } from './services/pg.service';
import { PublishingService } from './services/publishing.service';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [DatabaseModule, AuthModule, UploadsModule, VisitsModule],
  controllers: [
    PgController,
    PublicPgController,
    RoomsController,
    PublishingController,
    AdminPgController,
    OwnerVisitsController,
  ],
  providers: [AdminPgService, PgService, PublishingService, RoomsService],
})
export class PgModule {}
