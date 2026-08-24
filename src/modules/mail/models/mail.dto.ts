import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/** Asking for a code. */
export class SendOtpDto {
  @ApiProperty({ example: 'you@example.com', format: 'email' })
  @Transform(normalizeEmail)
  @MaxLength(254)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiPropertyOptional({
    example: 'Aarav',
    description: 'Used only to greet them in the email.',
  })
  @Transform(trimString)
  @IsOptional()
  @MaxLength(100)
  @IsString()
  name?: string;
}

/** Entering it. */
export class VerifyOtpDto {
  @ApiProperty({ example: 'you@example.com', format: 'email' })
  @Transform(normalizeEmail)
  @MaxLength(254)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiProperty({ example: '481920', description: 'The six digits from the email.' })
  @Transform(trimString)
  @Matches(/^\d{6}$/, { message: 'Enter the six-digit code from the email.' })
  @IsString({ message: 'Enter the six-digit code from the email.' })
  code!: string;
}

/** What a Super Admin can change about the sending account. */
export class UpdateMailSettingsDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @Transform(trimString)
  @MinLength(3, { message: 'Enter the SMTP host.' })
  @MaxLength(255)
  @IsString({ message: 'Enter the SMTP host.' })
  host!: string;

  @ApiProperty({ example: 587, description: '587 for STARTTLS, 465 for TLS.' })
  @Min(1)
  @Max(65535)
  @IsInt({ message: 'Enter the SMTP port.' })
  port!: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Defaults to true only for port 465.',
  })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiProperty({ example: 'you@gmail.com' })
  @Transform(trimString)
  @MinLength(3, { message: 'Enter the SMTP username.' })
  @MaxLength(255)
  @IsString({ message: 'Enter the SMTP username.' })
  username!: string;

  @ApiPropertyOptional({
    description:
      'Leave blank to keep the password already stored. Never returned by the API.',
  })
  @Transform(trimString)
  @IsOptional()
  @MaxLength(255)
  @IsString()
  password?: string;

  @ApiProperty({ example: 'Pzee' })
  @Transform(trimString)
  @MinLength(1, { message: 'Enter the name emails are sent from.' })
  @MaxLength(100)
  @IsString({ message: 'Enter the name emails are sent from.' })
  fromName!: string;

  @ApiProperty({ example: 'no-reply@pzee.in', format: 'email' })
  @Transform(normalizeEmail)
  @MaxLength(254)
  @IsEmail({}, { message: 'Enter the address emails are sent from.' })
  fromEmail!: string;
}

/** Where to send the test message. */
export class TestMailDto {
  @ApiProperty({ example: 'you@example.com', format: 'email' })
  @Transform(normalizeEmail)
  @MaxLength(254)
  @IsEmail({}, { message: 'Enter an address to send the test to.' })
  email!: string;
}

/** The Super Admin toggle. */
export class SetVerificationPolicyDto {
  @ApiProperty({
    example: true,
    description: 'True to require a code at registration, false to skip it.',
  })
  @IsBoolean({ message: 'required must be true or false.' })
  required!: boolean;
}
