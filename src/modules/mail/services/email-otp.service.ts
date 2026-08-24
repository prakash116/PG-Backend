/** Six-digit codes that prove someone holds an email address. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'node:crypto';
import { EmailOtpPurpose } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { otpEmailHtml, otpEmailText } from '../templates/otp-email';
import { MailerService } from './mailer.service';

const MILLISECONDS_PER_MINUTE = 60_000;

/** How long the person has to wait before asking for another code. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Long enough that a verification cannot be picked up days later, short enough
 * that filling in the rest of a registration form does not invalidate it.
 */
const VERIFIED_FOR_MINUTES = 30;

/** Only a hash is stored, so a leaked database hands out no live codes. */
function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Uniform across 000000–999999, from the crypto source rather than Math.random. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private get minutes(): number {
    return this.configService.getOrThrow<number>('app.mail.otpMinutes');
  }

  private get maxAttempts(): number {
    return this.configService.getOrThrow<number>('app.mail.otpMaxAttempts');
  }

  /**
   * Sends a fresh code, and returns when it expires.
   *
   * Any earlier code for the address is thrown away first: two live codes for
   * one inbox means the older one is a loose key nobody is watching.
   */
  async send(
    email: string,
    purpose: EmailOtpPurpose,
    name?: string,
  ): Promise<{ expiresAt: Date; resendAfterSeconds: number }> {
    const recent = await this.databaseService.emailOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (recent) {
      const waited = (Date.now() - recent.createdAt.getTime()) / 1000;

      if (waited < RESEND_COOLDOWN_SECONDS) {
        throw new ConflictException(
          `Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - waited)} seconds before asking for another code.`,
        );
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + this.minutes * MILLISECONDS_PER_MINUTE);

    // Send before storing. A stored code nobody received is worse than a send
    // that failed loudly, because the person is then stuck waiting for a
    // cooldown on an email that never arrived.
    await this.mailerService.send({
      to: email,
      subject: `${code} is your Pzee verification code`,
      text: otpEmailText({ code, minutes: this.minutes, name }),
      html: otpEmailHtml({ code, minutes: this.minutes, name }),
    });

    await this.databaseService.$transaction([
      this.databaseService.emailOtp.deleteMany({ where: { email, purpose } }),
      this.databaseService.emailOtp.create({
        data: { email, purpose, codeHash: hash(code), expiresAt },
      }),
    ]);

    return { expiresAt, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Checks a code the person typed.
   *
   * A wrong guess is counted, and the code is burned once there have been too
   * many — otherwise six digits is only a million tries away from anyone.
   */
  async verify(
    email: string,
    code: string,
    purpose: EmailOtpPurpose,
  ): Promise<void> {
    const otp = await this.databaseService.emailOtp.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException(
        'Ask for a code first, then enter it here.',
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'That code has expired. Ask for a new one.',
      );
    }

    if (otp.attempts >= this.maxAttempts) {
      throw new BadRequestException(
        'Too many wrong tries. Ask for a new code.',
      );
    }

    if (otp.codeHash !== hash(code)) {
      const { attempts } = await this.databaseService.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });

      const left = Math.max(0, this.maxAttempts - attempts);

      throw new BadRequestException(
        left > 0
          ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
          : 'Too many wrong tries. Ask for a new code.',
      );
    }

    await this.databaseService.emailOtp.update({
      where: { id: otp.id },
      data: { verifiedAt: new Date() },
      select: { id: true },
    });

    this.logger.log(`Email verified: ${email}`);
  }

  /**
   * Whether this address was verified recently enough to register with.
   *
   * Registration calls this rather than trusting anything the browser sends:
   * a client that says "I verified this" is only repeating what it was told.
   */
  async isVerified(
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<boolean> {
    const since = new Date(
      Date.now() - VERIFIED_FOR_MINUTES * MILLISECONDS_PER_MINUTE,
    );

    const otp = await this.databaseService.emailOtp.findFirst({
      where: {
        email,
        purpose,
        usedAt: null,
        verifiedAt: { not: null, gte: since },
      },
      select: { id: true },
    });

    return otp !== null;
  }

  /** Marks the verification spent, so one code makes exactly one account. */
  async consume(email: string, purpose: EmailOtpPurpose): Promise<void> {
    await this.databaseService.emailOtp.updateMany({
      where: { email, purpose, usedAt: null, verifiedAt: { not: null } },
      data: { usedAt: new Date() },
    });
  }
}
