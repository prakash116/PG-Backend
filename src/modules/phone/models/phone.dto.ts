import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsMobilePhone,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Proving a number. The MSG91 widget already checked the code in the browser
 * and handed back an access token; this is that token, brought to the API so
 * it can be confirmed with MSG91 directly — the browser is never trusted to
 * simply assert "verified".
 */
export class VerifyPhoneTokenDto {
  @ApiProperty({ example: '9876543210' })
  @Transform(trimString)
  @IsMobilePhone(undefined, undefined, {
    message: 'Enter a valid mobile number.',
  })
  phone!: string;

  @ApiProperty({
    description: "The access token the MSG91 widget returned after the code.",
  })
  @Transform(trimString)
  @MaxLength(4096)
  @MinLength(10, { message: 'The verification token is missing.' })
  @IsString({ message: 'The verification token is missing.' })
  accessToken!: string;
}

/** What a Super Admin can change about the SMS account. */
export class UpdateSmsSettingsDto {
  @ApiProperty({ description: 'MSG91 OTP widget id.' })
  @Transform(trimString)
  @MaxLength(255)
  @MinLength(6, { message: 'Enter the MSG91 widget id.' })
  @IsString({ message: 'Enter the MSG91 widget id.' })
  widgetId!: string;

  @ApiProperty({ description: 'MSG91 widget token auth.' })
  @Transform(trimString)
  @MaxLength(255)
  @MinLength(6, { message: 'Enter the MSG91 token auth.' })
  @IsString({ message: 'Enter the MSG91 token auth.' })
  tokenAuth!: string;

  @ApiPropertyOptional({
    description:
      'Leave blank to keep the authkey already stored. Never returned by the API.',
  })
  @Transform(trimString)
  @IsOptional()
  @MaxLength(255)
  @IsString()
  authkey?: string;
}

/** The Super Admin toggle for phone verification at registration. */
export class SetPhonePolicyDto {
  @ApiProperty({
    example: false,
    description: 'True to require a verified number at registration.',
  })
  @IsBoolean({ message: 'required must be true or false.' })
  required!: boolean;
}
