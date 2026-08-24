import { ApiProperty } from '@nestjs/swagger';

export class OtpSentDetail {
  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ example: 60, description: 'Seconds before another can be sent.' })
  resendAfterSeconds!: number;
}

export class OtpSentResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Code sent. Check your inbox.' })
  message!: string;

  @ApiProperty({ type: OtpSentDetail })
  data!: OtpSentDetail;
}

export class OtpVerifiedResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Email verified.' })
  message!: string;
}

/**
 * The mail account, as the settings page sees it — which is everything except
 * the password.
 */
export class MailSettingsDetail {
  @ApiProperty({ example: 'smtp.gmail.com' })
  host!: string;

  @ApiProperty({ example: 587 })
  port!: number;

  @ApiProperty({ example: false })
  secure!: boolean;

  @ApiProperty({ example: 'you@gmail.com' })
  username!: string;

  @ApiProperty({ example: 'Pzee' })
  fromName!: string;

  @ApiProperty({ example: 'no-reply@pzee.in' })
  fromEmail!: string;

  @ApiProperty({
    example: true,
    description: 'Whether a password is stored. The password itself never is returned.',
  })
  hasPassword!: boolean;

  @ApiProperty({
    enum: ['DATABASE', 'ENVIRONMENT'],
    description:
      'ENVIRONMENT means nothing has been saved yet and the SMTP_* variables are in use.',
  })
  source!: 'DATABASE' | 'ENVIRONMENT';

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  updatedAt!: string | null;

  @ApiProperty({ example: 'Pzee Admin', nullable: true, type: String })
  updatedBy!: string | null;
}

export class MailSettingsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Mail settings retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: MailSettingsDetail })
  data!: MailSettingsDetail;
}

export class MailTestResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Test email sent to you@example.com.' })
  message!: string;
}

/** Whether registration has to prove the email address. */
export class VerificationPolicyDetail {
  @ApiProperty({
    example: true,
    description:
      'When false, an account can be created without entering a code. Defaults to true.',
  })
  requireEmailVerification!: boolean;

  @ApiProperty({
    example: false,
    description:
      'When true, a number must be proven through the MSG91 widget. Defaults to false.',
  })
  requirePhoneVerification!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  updatedAt!: string | null;

  @ApiProperty({ example: 'Pzee Admin', nullable: true, type: String })
  updatedBy!: string | null;
}

export class VerificationPolicyResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Email verification is required.' })
  message!: string;

  @ApiProperty({ type: VerificationPolicyDetail })
  data!: VerificationPolicyDetail;
}
