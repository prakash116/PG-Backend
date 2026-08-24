/**
 * The Super Admin's SMS settings routes.
 *
 * Separate from PhoneModule for the same reason MailAdminModule is separate
 * from MailModule: the dependency arrows stay one-way,
 * PhoneAdminModule → AuthModule → PhoneModule.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { SmsSettingsController } from './controllers/phone.controller';
import { PhoneModule } from './phone.module';

@Module({
  // DatabaseModule is here because `@UseGuards` builds JwtAuthGuard inside this
  // module's injector, so the guard's own dependencies have to resolve here.
  // MailModule provides PlatformSettingsService for the verification toggle.
  imports: [DatabaseModule, AuthModule, MailModule, PhoneModule],
  controllers: [SmsSettingsController],
})
export class PhoneAdminModule {}
