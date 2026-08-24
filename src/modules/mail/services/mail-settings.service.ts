/** The mail account Pzee sends from: stored settings, or the environment. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../../database/database.service';
import { MailSettingsDetail } from '../models/mail-response.model';
import { UpdateMailSettingsDto } from '../models/mail.dto';
import { decryptSecret, encryptSecret } from './secret-box';

/** The single row. There is only ever one mail account. */
const SETTINGS_ID = 'default';

/** What the transport needs. The password never leaves this shape. */
export interface MailCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

@Injectable()
export class MailSettingsService {
  private readonly logger = new Logger(MailSettingsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * What to send with, in full.
   *
   * The stored row wins so a Super Admin can change the account without a
   * redeploy; the environment is the fallback so mail works the moment the app
   * boots on a fresh install.
   */
  async credentials(): Promise<MailCredentials | null> {
    const stored = await this.databaseService.mailSetting.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (stored) {
      const password = decryptSecret(stored.password, this.encryptionKey);

      // A rotated JWT_SECRET makes the stored password unreadable. That is not
      // a crash — it is "mail is not configured until it is entered again".
      if (!password) {
        this.logger.warn(
          'The stored mail password could not be decrypted. Re-enter it on the settings page.',
        );
        return null;
      }

      return {
        host: stored.host,
        port: stored.port,
        secure: stored.secure,
        username: stored.username,
        password,
        fromName: stored.fromName,
        fromEmail: stored.fromEmail,
      };
    }

    const fromEnv = this.configService.getOrThrow<MailCredentials>('app.mail');

    if (!fromEnv.host || !fromEnv.username || !fromEnv.password) return null;

    return fromEnv;
  }

  /** What the settings page shows. Never the password. */
  async detail(): Promise<MailSettingsDetail> {
    const stored = await this.databaseService.mailSetting.findUnique({
      where: { id: SETTINGS_ID },
      include: {
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (stored) {
      return {
        host: stored.host,
        port: stored.port,
        secure: stored.secure,
        username: stored.username,
        fromName: stored.fromName,
        fromEmail: stored.fromEmail,
        hasPassword: Boolean(
          decryptSecret(stored.password, this.encryptionKey),
        ),
        source: 'DATABASE',
        updatedAt: stored.updatedAt.toISOString(),
        updatedBy: stored.updatedBy
          ? [stored.updatedBy.firstName, stored.updatedBy.lastName]
              .filter(Boolean)
              .join(' ')
          : null,
      };
    }

    const fromEnv = this.configService.getOrThrow<MailCredentials>('app.mail');

    return {
      host: fromEnv.host,
      port: fromEnv.port,
      secure: fromEnv.secure,
      username: fromEnv.username,
      fromName: fromEnv.fromName,
      fromEmail: fromEnv.fromEmail,
      hasPassword: Boolean(fromEnv.password),
      source: 'ENVIRONMENT',
      updatedAt: null,
      updatedBy: null,
    };
  }

  /**
   * Saves what a Super Admin entered.
   *
   * The password is optional on an update: leaving it blank keeps the one
   * already stored, so changing the sender name does not mean typing an app
   * password again.
   */
  async update(
    dto: UpdateMailSettingsDto,
    adminId: string,
  ): Promise<MailSettingsDetail> {
    const existing = await this.databaseService.mailSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { password: true },
    });

    const password = dto.password
      ? encryptSecret(dto.password, this.encryptionKey)
      : (existing?.password ??
        encryptSecret(
          this.configService.getOrThrow<MailCredentials>('app.mail').password,
          this.encryptionKey,
        ));

    const data = {
      host: dto.host,
      port: dto.port,
      secure: dto.secure ?? dto.port === 465,
      username: dto.username,
      password,
      fromName: dto.fromName,
      fromEmail: dto.fromEmail,
      updatedById: adminId,
    };

    await this.databaseService.mailSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
      select: { id: true },
    });

    this.logger.log(`Mail settings updated: ${dto.username} via ${dto.host}`);

    return this.detail();
  }

  /**
   * `JWT_SECRET` doubles as the encryption key. It is already required, already
   * secret, and already different in production — which is exactly what this
   * needs, without adding another variable someone has to remember to set.
   */
  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }
}
