/**
 * The Super Admin's mail settings routes.
 *
 * Separate from MailModule so the dependency arrows stay one-way:
 * MailAdminModule → AuthModule → MailModule. Putting these guarded routes in
 * MailModule would make it import AuthModule, which already imports it.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MailSettingsController } from './controllers/mail.controller';
import { MailModule } from './mail.module';

@Module({
  // DatabaseModule is here because `@UseGuards` builds JwtAuthGuard inside this
  // module's injector, so the guard's own dependencies have to resolve here —
  // the same reason AuthModule re-exports JwtModule and SessionCookieService.
  imports: [DatabaseModule, AuthModule, MailModule],
  controllers: [MailSettingsController],
})
export class MailAdminModule {}
