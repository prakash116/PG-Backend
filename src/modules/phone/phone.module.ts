/**
 * Phone module: the MSG91 account, and the proofs that a number was verified.
 *
 * Mirrors MailModule, cycle and all: registration needs
 * `PhoneVerificationService`, so AuthModule imports this one — which is why
 * this module must never import AuthModule back. The guarded settings routes
 * live in `PhoneAdminModule` instead.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PhoneVerificationController } from './controllers/phone.controller';
import { PhoneVerificationService } from './services/phone-verification.service';
import { SmsSettingsService } from './services/sms-settings.service';

@Module({
  imports: [DatabaseModule],
  // Public: it runs on the registration form, before any account exists.
  controllers: [PhoneVerificationController],
  providers: [PhoneVerificationService, SmsSettingsService],
  exports: [PhoneVerificationService, SmsSettingsService],
})
export class PhoneModule {}
