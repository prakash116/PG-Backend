import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitStatus } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimText({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** The shareable code an owner quotes, e.g. PZ-4F7K2A. */
const PG_CODE_PATTERN = /^PZ-[A-Z0-9]{6}$/;

export class CreateVisitDto {
  @ApiProperty({
    example: 'PZ-4F7K2A',
    description: 'Which PG the visit is for.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'A PG code is required.' })
  @Matches(PG_CODE_PATTERN, { message: 'That is not a valid PG ID.' })
  pgCode!: string;

  @ApiPropertyOptional({
    example: '2026-08-30',
    description: 'When they would like to visit.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  preferredDate?: string;

  @ApiPropertyOptional({ example: 'Can I see it on a weekend?' })
  @Transform(trimText)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class UpdateVisitDto {
  @ApiProperty({ enum: VisitStatus })
  @IsEnum(VisitStatus)
  status!: VisitStatus;
}

export class ListVisitsQuery {
  @ApiPropertyOptional({
    enum: VisitStatus,
    description: 'Leave empty for every request.',
  })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;
}
