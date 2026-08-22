import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Gender,
  ResidentStatus,
  RoomType,
  UserType,
} from '../../../generated/prisma/client';

const MAX_RUPEES = 10_000_000;

/** A service the resident takes, billed on top of rent each month. */
export class ResidentServiceInput {
  @ApiProperty({ example: 'Food', description: 'One of the PG amenities.' })
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  @IsNotEmpty({ message: 'A service needs a name.' })
  name!: string;

  @ApiProperty({ example: 3000, description: 'Charged monthly. 0 if included.' })
  @IsInt()
  @Min(0)
  @Max(MAX_RUPEES)
  monthlyAmount!: number;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateResidentDto {
  @ApiProperty({ example: 'Ananya Sharma', minLength: 2, maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty({ message: 'Guest name is required.' })
  fullName!: string;

  @ApiProperty({
    example: '9876543210',
    description:
      'Used to link the guest to their Pzee account when one is registered.',
  })
  @Transform(trimString)
  @IsMobilePhone()
  phone!: string;

  @ApiPropertyOptional({ example: '12 MG Road, Bengaluru' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    enum: UserType,
    description: 'Student, employee, or something else.',
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiProperty({
    enum: RoomType,
    description: 'Which sharing type the guest occupies. Must have a free bed.',
  })
  @IsEnum(RoomType)
  roomType!: RoomType;

  @ApiProperty({ example: 9800, description: 'Rent this guest pays a month.' })
  @IsInt()
  @Min(1)
  @Max(MAX_RUPEES)
  monthlyRent!: number;


  @ApiPropertyOptional({
    example: 'cm1234567890',
    description: 'The room they are allocated. Must have a free bed.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ type: [ResidentServiceInput] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ResidentServiceInput)
  services?: ResidentServiceInput[];

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'When they moved in. Defaults to today.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  joinedAt?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'When their next rent is due.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string;
}

/** Every field optional: the dashboard edits one thing at a time. */
export class UpdateResidentDto {
  @ApiPropertyOptional({ example: 'Ananya Sharma' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @Transform(trimString)
  @IsOptional()
  @IsMobilePhone()
  phone?: string;

  @ApiPropertyOptional({ example: '12 MG Road, Bengaluru' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: UserType })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @ApiPropertyOptional({ example: 9800 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RUPEES)
  monthlyRent?: number;


  @ApiPropertyOptional({
    example: 'cm1234567890',
    description: 'The room they are allocated. Must have a free bed.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ type: [ResidentServiceInput] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ResidentServiceInput)
  services?: ResidentServiceInput[];

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string;
}

export class ListResidentsQuery {
  @ApiPropertyOptional({
    enum: ResidentStatus,
    description: 'Defaults to ACTIVE. Pass LEFT for past guests.',
  })
  @IsOptional()
  @IsEnum(ResidentStatus)
  status?: ResidentStatus;

  @ApiPropertyOptional({ description: 'Matches name or phone.' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class CreatePaymentDto {
  @ApiProperty({ example: 9800 })
  @IsInt()
  @Min(1)
  @Max(MAX_RUPEES)
  amount!: number;

  @ApiPropertyOptional({
    example: '2026-08-22',
    description: 'When it was paid. Defaults to today; cannot be in the future.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  paidOn?: string;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'The rent month this covers.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  forMonth?: string;

  @ApiPropertyOptional({ example: 'Paid by UPI' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CrmSummaryQuery {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Start of the collection period. Defaults to this month.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
