/** PG module: lets an owner manage their property listing. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PgController } from './controllers/pg.controller';
import { RoomsController } from './controllers/rooms.controller';
import { PgService } from './services/pg.service';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [DatabaseModule, AuthModule, UploadsModule],
  controllers: [PgController, RoomsController],
  providers: [PgService, RoomsService],
})
export class PgModule {}
