import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, UserType } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * An absolute URL or a path served by this API, e.g. /uploads/abc.webp — and an
 * empty string, which is how the account page removes a photo. Without that
 * alternative there is no way to say "I no longer want one".
 */
const PROFILE_IMAGE_PATTERN = /^$|^(https?:\/\/|\/)[^\s]+$/;

/**
 * What a signed-in person may change about their own account.
 *
 * `role`, `isActive`, `isBlocked` and the verification flags are absent by
 * design, not by oversight. With the global ValidationPipe running
 * `whitelist: true` an unknown key is stripped from the body, and the service
 * copies only the fields listed here — so sending `"role": "SUPER_ADMIN"`
 * changes nothing.
 *
 * Every field is optional: the account page saves one section at a time, and
 * PATCH means "leave the rest alone".
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Aarav' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @IsNotEmpty({ message: 'First name cannot be empty.' })
  firstName?: string;

  /** An empty string clears it: plenty of people go by one name. */
  @ApiPropertyOptional({ example: 'Sharma', nullable: true })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'aarav@gmail.com', format: 'email' })
  @Transform(normalizeEmail)
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Transform(trimString)
  @IsOptional()
  @IsMobilePhone(undefined, undefined, {
    message: 'Enter a valid mobile number.',
  })
  phone?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '2001-05-12', format: 'date' })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Date of birth must be a valid date (YYYY-MM-DD).' },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: UserType, example: UserType.STUDENT })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({ example: '/uploads/profile/8f2c1d.webp' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_PATTERN, {
    message: 'Profile image must be a URL or an uploaded image path.',
  })
  profileImage?: string;

  @ApiPropertyOptional({ example: 'Laxmi Nagar, New Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'New Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional({ example: '110092' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(12)
  pincode?: string;
}
