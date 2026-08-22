import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Cooling, PgGender } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimList({ value }: TransformFnParams): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  // Blank entries would render as empty chips on the listing cards.
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
    .filter((entry) => entry !== '');
}

/** An absolute URL, or a path served by this API. */
const IMAGE_PATTERN = /^(https?:\/\/|\/)[^\s]+$/;

/** Same, but an empty string is allowed so the owner can remove the logo. */
const LOGO_PATTERN = /^$|^(https?:\/\/|\/)[^\s]+$/;

/** Rupee amounts, wide enough for a premium listing but not a typo. */
const MAX_RUPEES = 10_000_000;

/**
 * Every field is optional: the dashboard saves one section at a time.
 *
 * `verification`, `rating`, `reviewCount`, `pgCode` and `ownerId` are absent by
 * design. With the global ValidationPipe running `whitelist: true`, sending them
 * strips them from the body, so an owner cannot verify their own listing or
 * invent a rating.
 */
export class UpdatePgDto {
  @ApiPropertyOptional({ example: 'Sunrise Boys PG' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsNotEmpty({ message: 'PG house name cannot be empty.' })
  name?: string;

  @ApiPropertyOptional({ example: 'Kohat Enclave, Pitampura' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsNotEmpty({ message: 'PG location cannot be empty.' })
  location?: string;

  @ApiPropertyOptional({ example: 'New Delhi' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    example: 'Airy rooms with study desks, five minutes from the metro.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 8500, description: 'Starting monthly rent.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_RUPEES)
  price?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_RUPEES)
  deposit?: number;

  @ApiPropertyOptional({ enum: PgGender, example: PgGender.BOYS })
  @IsOptional()
  @IsEnum(PgGender)
  gender?: PgGender;

  @ApiPropertyOptional({ enum: Cooling, example: Cooling.AC })
  @IsOptional()
  @IsEnum(Cooling)
  cooling?: Cooling;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  foodIncluded?: boolean;

  @ApiPropertyOptional({ example: 'Breakfast, lunch and dinner included.' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  foodDetails?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../logo.png',
    description:
      'Square brand mark. Send an empty string to remove the current one.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(LOGO_PATTERN, {
    message: 'Logo must be a URL, an uploaded image path, or empty.',
  })
  logo?: string;

  @ApiPropertyOptional({
    example: ['WiFi', 'Laundry', 'Parking'],
    type: [String],
  })
  @Transform(trimList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    example: ['https://res.cloudinary.com/.../pg.jpg'],
    type: [String],
    description: 'URLs returned by POST /v1/uploads/pg-image.',
  })
  @Transform(trimList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @Matches(IMAGE_PATTERN, {
    each: true,
    message: 'Each image must be a URL or an uploaded image path.',
  })
  images?: string[];
}
