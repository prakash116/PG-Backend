/** Sending mail through whatever SMTP account is configured. */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MailCredentials, MailSettingsService } from './mail-settings.service';

interface Transport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId?: string }>;
  verify(): Promise<true>;
  close(): void;
}

interface NodemailerApi {
  createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    connectionTimeout: number;
    greetingTimeout: number;
    socketTimeout: number;
  }): Transport;
}

/** Required the way bcrypt and multer are in this project. */
const nodemailer = require('nodemailer') as NodemailerApi;

/** Gmail is not always quick. Long enough to succeed, short enough to fail. */
const TIMEOUT_MS = 20_000;

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  /** Kept between sends: a fresh SMTP handshake per email is slow and rude. */
  private transport: Transport | null = null;
  private signature = '';

  constructor(private readonly mailSettingsService: MailSettingsService) {}

  async send(input: SendMailInput): Promise<void> {
    const { transport, credentials } = await this.connect();

    try {
      await transport.sendMail({
        from: `"${credentials.fromName}" <${credentials.fromEmail}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });

      this.logger.log(`Sent "${input.subject}" to ${input.to}`);
    } catch (error: unknown) {
      // A dead transport is worse than none: drop it so the next send builds a
      // fresh one rather than failing the same way forever.
      this.reset();

      this.logger.error(
        `Could not send to ${input.to}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );

      throw new ServiceUnavailableException(
        'Could not send the email. Please try again in a moment.',
      );
    }
  }

  /** Proves the credentials work, without sending anything. */
  async verifyConnection(): Promise<void> {
    const { transport } = await this.connect();

    try {
      await transport.verify();
    } catch (error: unknown) {
      this.reset();

      throw new ServiceUnavailableException(
        `The mail server refused the connection: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * Reuses the open connection unless the settings changed underneath it —
   * which they can, because a Super Admin edits them at runtime.
   */
  private async connect(): Promise<{
    transport: Transport;
    credentials: MailCredentials;
  }> {
    const credentials = await this.mailSettingsService.credentials();

    if (!credentials) {
      throw new ServiceUnavailableException(
        'Email is not set up yet. A Super Admin can add the mail account under Settings.',
      );
    }

    const signature = [
      credentials.host,
      credentials.port,
      credentials.secure,
      credentials.username,
      credentials.password,
    ].join('|');

    if (!this.transport || this.signature !== signature) {
      this.reset();

      this.transport = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: { user: credentials.username, pass: credentials.password },
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
      });
      this.signature = signature;
    }

    return { transport: this.transport, credentials };
  }

  private reset(): void {
    try {
      this.transport?.close();
    } catch {
      // Already gone. Nothing to do.
    }

    this.transport = null;
    this.signature = '';
  }
}
