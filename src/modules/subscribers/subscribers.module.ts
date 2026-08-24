/** Subscribers module: the newsletter list behind the site footer form. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  AdminSubscribersController,
  SubscribeController,
} from './controllers/subscribers.controller';
import { SubscribersService } from './services/subscribers.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SubscribeController, AdminSubscribersController],
  providers: [SubscribersService],
})
export class SubscribersModule {}
