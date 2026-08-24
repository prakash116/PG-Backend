/** Contact module: messages sent from the public Contact Us form. */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  AdminContactController,
  ContactController,
} from './controllers/contact.controller';
import { ContactService } from './services/contact.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
})
export class ContactModule {}
