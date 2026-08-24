import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, UserRole, UserType } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/** "Find a PG" applicants describe themselves; "List a PG" owners describe a property. */
function isSeeker(dto: RegisterDto): boolean {
  return dto.role === UserRole.USER;
}

function isOwner(dto: RegisterDto): boolean {
  return dto.role === UserRole.PG_OWNER;
}

/** Either an absolute URL or a path served by this API, e.g. /uploads/abc.webp */
const PROFILE_IMAGE_PATTERN = /^(https?:\/\/|\/)[^\s]+$/;

/**
 * `PZR-` and six characters from the unambiguous alphabet. An empty string is
 * allowed so the field can simply be left blank on the form.
 */
const REFERRAL_CODE_PATTERN = /^$|^PZR-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/** People paste codes with stray spaces and in lower case; both are fine. */
function normalizeReferralCode({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/**
 * One registration payload for both audiences. `role` selects which of the two
 * field sets is required, so a single endpoint and a single Swagger schema
 * cover "Find a PG" and "List a PG".
 */
export class RegisterDto {
  @ApiProperty({
    enum: [UserRole.USER, UserRole.PG_OWNER],
    example: UserRole.USER,
    description:
      'USER registers someone looking for a PG. PG_OWNER registers an owner and creates their PG.',
  })
  @IsIn([UserRole.USER, UserRole.PG_OWNER], {
    message: 'Role must be either USER or PG_OWNER.',
  })
  role!: UserRole;

  @ApiProperty({
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
    description:
      'Full name of the person registering. For an owner this is the owner name.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty({ message: 'Full name is required.' })
  fullName!: string;

  @ApiProperty({ example: 'john@gmail.com', format: 'email' })
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '9876543210' })
  @Transform(trimString)
  @IsMobilePhone()
  phone!: string;

  @ApiProperty({ example: 'Password@123', minLength: 8, format: 'password' })
  @IsString()
  @MinLength(8)
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must contain an uppercase letter, lowercase letter, number, and special character.',
    },
  )
  password!: string;

  @ApiPropertyOptional({
    example: '/uploads/profile/8f2c1d.webp',
    description: 'URL returned by POST /v1/uploads/profile-image.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(PROFILE_IMAGE_PATTERN, {
    message: 'Profile image must be a URL or an uploaded image path.',
  })
  profileImage?: string;

  // ----- "Find a PG" (USER) -----

  @ApiPropertyOptional({
    example: 'Laxmi Nagar, New Delhi',
    description: 'Required when role is USER.',
  })
  @ValidateIf(isSeeker)
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  @IsNotEmpty({ message: 'Address is required.' })
  address?: string;

  @ApiPropertyOptional({
    example: '2001-05-12',
    format: 'date',
    description: 'Required when role is USER.',
  })
  @ValidateIf(isSeeker)
  @IsDateString(
    { strict: true },
    { message: 'Date of birth must be a valid date (YYYY-MM-DD).' },
  )
  dateOfBirth?: string;

  @ApiPropertyOptional({
    enum: UserType,
    example: UserType.WORKING_PROFESSIONAL,
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  // ----- "List a PG" (PG_OWNER) -----

  @ApiPropertyOptional({
    example: 'Sunrise Boys PG',
    description: 'PG house name. Required when role is PG_OWNER.',
  })
  @ValidateIf(isOwner)
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsNotEmpty({ message: 'PG house name is required.' })
  pgName?: string;

  @ApiPropertyOptional({
    example: 'Kohat Enclave, Pitampura, Delhi',
    description: 'PG location. Required when role is PG_OWNER.',
  })
  @ValidateIf(isOwner)
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  @IsNotEmpty({ message: 'PG location is required.' })
  pgLocation?: string;

  @ApiPropertyOptional({
    example: 'PZR-4F7K2A',
    description:
      'Optional. The referral code of the customer who introduced this PG. Only read when role is PG_OWNER.',
  })
  @Transform(normalizeReferralCode)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(REFERRAL_CODE_PATTERN, {
    message: 'That referral code does not look right. It reads like PZR-4F7K2A.',
  })
  referralCode?: string;

  // ----- Optional, kept so existing callers that still send them keep working -----

  @ApiPropertyOptional({ example: 'India' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'New Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '110092' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  pincode?: string;
}
