/** The MSG91 account SMS codes go out through: stored settings, or the environment. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../../database/database.service';
import { decryptSecret, encryptSecret } from '../../mail/services/secret-box';
import {
  SmsSettingsDetail,
  WidgetConfigDetail,
} from '../models/phone-response.model';
import { UpdateSmsSettingsDto } from '../models/phone.dto';

/** The single row. There is only ever one MSG91 account. */
const SETTINGS_ID = 'default';

/** What the environment fallback looks like in app.config.ts. */
interface SmsEnvironment {
  widgetId: string;
  tokenAuth: string;
  authkey: string;
}

@Injectable()
export class SmsSettingsService {
  private readonly logger = new Logger(SmsSettingsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The account authkey, in full — used only to confirm widget access tokens
   * with MSG91, and never returned by any route.
   *
   * The stored row wins so a Super Admin can change the account without a
   * redeploy; the environment is the fallback so SMS works the moment the app
   * boots on a fresh install.
   */
  async authkey(): Promise<string | null> {
    const stored = await this.databaseService.smsSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { authkey: true },
    });

    if (stored) {
      const authkey = decryptSecret(stored.authkey, this.encryptionKey);

      // A rotated JWT_SECRET makes the stored authkey unreadable. Not a crash —
      // "SMS is not configured until it is entered again".
      if (!authkey) {
        this.logger.warn(
          'The stored MSG91 authkey could not be decrypted. Re-enter it on the settings page.',
        );
        return null;
      }

      return authkey;
    }

    const fromEnv = this.configService.getOrThrow<SmsEnvironment>('app.sms');

    return fromEnv.authkey || null;
  }

  /**
   * What the register page needs to run the widget. Public — widgetId and
   * tokenAuth are client-side values by MSG91's design. The authkey is not
   * part of this shape on purpose.
   */
  async widgetConfig(): Promise<WidgetConfigDetail> {
    const stored = await this.databaseService.smsSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { widgetId: true, tokenAuth: true },
    });

    const fromEnv = this.configService.getOrThrow<SmsEnvironment>('app.sms');
    const widgetId = stored?.widgetId || fromEnv.widgetId;
    const tokenAuth = stored?.tokenAuth || fromEnv.tokenAuth;

    return {
      configured: Boolean(widgetId && tokenAuth),
      widgetId: widgetId || null,
      tokenAuth: tokenAuth || null,
    };
  }

  /** What the settings page shows. Never the authkey. */
  async detail(): Promise<SmsSettingsDetail> {
    const stored = await this.databaseService.smsSetting.findUnique({
      where: { id: SETTINGS_ID },
      include: {
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (stored) {
      return {
        widgetId: stored.widgetId,
        tokenAuth: stored.tokenAuth,
        hasAuthkey: Boolean(decryptSecret(stored.authkey, this.encryptionKey)),
        source: 'DATABASE',
        updatedAt: stored.updatedAt.toISOString(),
        updatedBy: stored.updatedBy
          ? [stored.updatedBy.firstName, stored.updatedBy.lastName]
              .filter(Boolean)
              .join(' ')
          : null,
      };
    }

    const fromEnv = this.configService.getOrThrow<SmsEnvironment>('app.sms');

    return {
      widgetId: fromEnv.widgetId,
      tokenAuth: fromEnv.tokenAuth,
      hasAuthkey: Boolean(fromEnv.authkey),
      source: 'ENVIRONMENT',
      updatedAt: null,
      updatedBy: null,
    };
  }

  /**
   * Saves what a Super Admin entered. The authkey is optional on an update:
   * leaving it blank keeps the one already stored, so changing the widget id
   * does not mean pasting the authkey again.
   */
  async update(
    dto: UpdateSmsSettingsDto,
    adminId: string,
  ): Promise<SmsSettingsDetail> {
    const existing = await this.databaseService.smsSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { authkey: true },
    });

    const authkey = dto.authkey
      ? encryptSecret(dto.authkey, this.encryptionKey)
      : (existing?.authkey ??
        encryptSecret(
          this.configService.getOrThrow<SmsEnvironment>('app.sms').authkey,
          this.encryptionKey,
        ));

    const data = {
      widgetId: dto.widgetId,
      tokenAuth: dto.tokenAuth,
      authkey,
      updatedById: adminId,
    };

    await this.databaseService.smsSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
      select: { id: true },
    });

    this.logger.log(`SMS settings updated: widget ${dto.widgetId}`);

    return this.detail();
  }

  /** `JWT_SECRET` doubles as the encryption key, exactly as for mail. */
  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }
}
