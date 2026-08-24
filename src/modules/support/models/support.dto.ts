import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportTicketStatus } from '../../../generated/prisma/client';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** What a PG owner sends from the contact form. */
export class RaiseTicketDto {
  @ApiProperty({
    example: 'Cannot upload room photos',
    description: 'A short summary of the problem.',
  })
  @Transform(trimString)
  @MinLength(4, { message: 'Give the query a title of at least 4 characters.' })
  @MaxLength(120)
  @IsNotEmpty({ message: 'Give the query a title.' })
  @IsString({ message: 'Give the query a title.' })
  title!: string;

  @ApiProperty({
    example: 'The upload spins and then fails on the bathroom photo slot.',
    description: 'What is going wrong, in the owner’s own words.',
  })
  @Transform(trimString)
  @MinLength(10, {
    message: 'Describe the problem in at least 10 characters.',
  })
  @MaxLength(2000)
  @IsNotEmpty({ message: 'Describe the problem.' })
  @IsString({ message: 'Describe the problem.' })
  message!: string;
}

/**
 * How a Super Admin closes a query. `OPEN` is absent on purpose: it is where a
 * ticket starts, not somewhere it is moved back to.
 */
export class ResolveTicketDto {
  @ApiProperty({
    enum: [SupportTicketStatus.SOLVED, SupportTicketStatus.REJECTED],
    example: SupportTicketStatus.SOLVED,
  })
  @IsEnum(
    { SOLVED: SupportTicketStatus.SOLVED, REJECTED: SupportTicketStatus.REJECTED },
    { message: 'Status must be either SOLVED or REJECTED.' },
  )
  status!: SupportTicketStatus;

  @ApiPropertyOptional({
    example: 'Fixed — the photo was over 5 MB. Try again with a smaller one.',
    description:
      'Shown to the owner. Worth writing on a rejection, which otherwise reads as a shrug.',
  })
  @Transform(trimString)
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  response?: string;
}
