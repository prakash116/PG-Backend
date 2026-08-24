/**
 * Mail module: the sending account, and the codes that verify an address.
 *
 * Deliberately does NOT import AuthModule. Registration needs `EmailOtpService`,
 * so AuthModule imports this one — and if this one imported AuthModule back,
 * the two would be a cycle that Nest resolves as `undefined` at boot. The
 * guarded settings routes live in `MailAdminModule` instead, which sits on the
 * far side of that arrow and can import both.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmailVerificationController } from './controllers/mail.controller';
import { EmailOtpService } from './services/email-otp.service';
import { MailSettingsService } from './services/mail-settings.service';
import { MailerService } from './services/mailer.service';
import { PlatformSettingsService } from './services/platform-settings.service';

@Module({
  imports: [DatabaseModule],
  // Public: it runs on the registration form, before any account exists.
  controllers: [EmailVerificationController],
  providers: [
    EmailOtpService,
    MailSettingsService,
    MailerService,
    PlatformSettingsService,
  ],
  exports: [
    EmailOtpService,
    MailSettingsService,
    MailerService,
    PlatformSettingsService,
  ],
})
export class MailModule {}
