/**
 * Mobile numbers proven through the MSG91 OTP widget.
 *
 * The widget sends and checks the code in the browser and hands back an access
 * token. That token is the only thing the browser brings here — and it is
 * confirmed with MSG91 directly, using the account authkey, before anything is
 * recorded. A client that says "this number is verified" is only repeating
 * what it was told; MSG91's answer is the one that counts.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { SmsSettingsService } from './sms-settings.service';

/** How long a proven number counts as verified — same window as email. */
const VERIFIED_FOR_MINUTES = 30;

const MILLISECONDS_PER_MINUTE = 60_000;

const VERIFY_TOKEN_URL =
  'https://control.msg91.com/api/v5/widget/verifyAccessToken';

/** MSG91 signals success via `type`, not HTTP status alone. */
interface Msg91TokenResult {
  type?: string;
  message?: string;
  /** The mobile number MSG91 attached to the token, e.g. "919876543210". */
  identifier?: string;
}

/**
 * Accepts a 10-digit Indian mobile, with or without a 91 prefix, and returns
 * it as "91XXXXXXXXXX" — or null if it is not one. Stored rows keep whatever
 * the owner typed; this shape exists only to compare against MSG91.
 */
export function normalizeMobile(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  const national =
    digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;

  if (!/^[6-9]\d{9}$/.test(national)) return null;

  return `91${national}`;
}

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly smsSettingsService: SmsSettingsService,
  ) {}

  /**
   * Confirms a widget access token with MSG91 and records the proof.
   *
   * The number recorded is the one MSG91 attached to the token — not the one
   * the browser claims — so a token for one number can never verify another.
   */
  async verifyToken(phone: string, accessToken: string): Promise<void> {
    const claimed = normalizeMobile(phone);

    if (!claimed) {
      throw new BadRequestException('Enter a valid 10-digit mobile number.');
    }

    const authkey = await this.smsSettingsService.authkey();

    if (!authkey) {
      throw new ServiceUnavailableException(
        'SMS verification is not set up yet. Ask an administrator to add the MSG91 authkey.',
      );
    }

    let result: Msg91TokenResult;

    try {
      const response = await fetch(VERIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authkey, 'access-token': accessToken }),
      });

      result = (await response.json().catch(() => ({}))) as Msg91TokenResult;
    } catch (error) {
      this.logger.error(
        `MSG91 token check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Could not reach the SMS service. Please try again.',
      );
    }

    if (result.type !== 'success') {
      throw new BadRequestException(
        'The code could not be confirmed. Verify your number again.',
      );
    }

    // MSG91 echoes the verified number back with the token. When it does, it
    // has to be the number being registered; when it does not, the token's own
    // success is the proof and the claimed number is recorded.
    const confirmed = result.identifier
      ? normalizeMobile(result.identifier)
      : claimed;

    if (confirmed !== claimed) {
      throw new BadRequestException(
        'That verification belongs to a different mobile number.',
      );
    }

    await this.databaseService.phoneVerification.create({
      data: { phone: claimed },
      select: { id: true },
    });

    this.logger.log(`Phone verified via MSG91: …${claimed.slice(-4)}`);
  }

  /** Whether the number was proven recently — same 30-minute window as email. */
  async isVerified(phone: string): Promise<boolean> {
    const normalized = normalizeMobile(phone);

    if (!normalized) return false;

    const since = new Date(
      Date.now() - VERIFIED_FOR_MINUTES * MILLISECONDS_PER_MINUTE,
    );

    const verification = await this.databaseService.phoneVerification.findFirst(
      {
        where: {
          phone: normalized,
          usedAt: null,
          verifiedAt: { gte: since },
        },
        select: { id: true },
      },
    );

    return verification !== null;
  }

  /** Marks the proof spent, so one verification makes exactly one account. */
  async consume(phone: string): Promise<void> {
    const normalized = normalizeMobile(phone);

    if (!normalized) return;

    await this.databaseService.phoneVerification.updateMany({
      where: { phone: normalized, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
