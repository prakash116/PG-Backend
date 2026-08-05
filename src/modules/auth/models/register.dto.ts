import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, UserRole, UserType } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterDto {
  @ApiProperty({ example: 'John', minLength: 2, maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiProperty({
    enum: [UserRole.PG_OWNER, UserRole.USER],
    example: UserRole.PG_OWNER,
  })
  @IsEnum(UserRole)
  role!: UserRole;

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

  @ApiPropertyOptional({ example: '2001-05-12', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateOfBirth?: string;

  @ApiProperty({ example: 'India' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ example: 'Delhi' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ example: 'New Delhi' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ example: 'Laxmi Nagar' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: '110092' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  pincode!: string;
}
