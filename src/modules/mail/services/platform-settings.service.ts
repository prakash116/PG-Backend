/** Platform-wide switches a Super Admin controls from the dashboard. */
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { VerificationPolicyDetail } from '../models/mail-response.model';

/** One row, always. */
const SETTINGS_ID = 'default';

/**
 * Verification is required until somebody deliberately turns it off.
 *
 * A missing row must not mean "anyone can register with any address": the safe
 * reading of no answer is the strict one.
 */
const DEFAULT_REQUIRE_EMAIL_VERIFICATION = true;

/**
 * Phone starts OFF — the opposite default, for the opposite reason. Email
 * verification was already being enforced when its switch was added; phone
 * never has been, and a default of true would refuse every registration on
 * the live site before the MSG91 widget is even configured.
 */
const DEFAULT_REQUIRE_PHONE_VERIFICATION = false;

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Whether registration must prove the email address. */
  async requireEmailVerification(): Promise<boolean> {
    const setting = await this.databaseService.platformSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { requireEmailVerification: true },
    });

    return setting?.requireEmailVerification ?? DEFAULT_REQUIRE_EMAIL_VERIFICATION;
  }

  /** Whether registration must prove the mobile number. */
  async requirePhoneVerification(): Promise<boolean> {
    const setting = await this.databaseService.platformSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { requirePhoneVerification: true },
    });

    return (
      setting?.requirePhoneVerification ?? DEFAULT_REQUIRE_PHONE_VERIFICATION
    );
  }

  /** What the registration page and the settings page both read. */
  async policy(): Promise<VerificationPolicyDetail> {
    const setting = await this.databaseService.platformSetting.findUnique({
      where: { id: SETTINGS_ID },
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
    });

    return {
      requireEmailVerification:
        setting?.requireEmailVerification ??
        DEFAULT_REQUIRE_EMAIL_VERIFICATION,
      requirePhoneVerification:
        setting?.requirePhoneVerification ??
        DEFAULT_REQUIRE_PHONE_VERIFICATION,
      updatedAt: setting?.updatedAt ? setting.updatedAt.toISOString() : null,
      updatedBy: setting?.updatedBy
        ? [setting.updatedBy.firstName, setting.updatedBy.lastName]
            .filter(Boolean)
            .join(' ')
        : null,
    };
  }

  /** Flips the switch. Takes effect on the next registration. */
  async setRequireEmailVerification(
    required: boolean,
    adminId: string,
  ): Promise<VerificationPolicyDetail> {
    await this.databaseService.platformSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        requireEmailVerification: required,
        updatedById: adminId,
      },
      update: { requireEmailVerification: required, updatedById: adminId },
      select: { id: true },
    });

    this.logger.log(
      `Email verification is now ${required ? 'required' : 'optional'} for registration`,
    );

    return this.policy();
  }

  /** Flips the phone switch. Takes effect on the next registration. */
  async setRequirePhoneVerification(
    required: boolean,
    adminId: string,
  ): Promise<VerificationPolicyDetail> {
    await this.databaseService.platformSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        requirePhoneVerification: required,
        updatedById: adminId,
      },
      update: { requirePhoneVerification: required, updatedById: adminId },
      select: { id: true },
    });

    this.logger.log(
      `Phone verification is now ${required ? 'required' : 'optional'} for registration`,
    );

    return this.policy();
  }
}
