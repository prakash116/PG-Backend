import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserStatsQuery {
  @ApiPropertyOptional({
    example: '2026-07-26',
    format: 'date',
    description: 'Defaults to 30 days before `to`.',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'from must be a date like 2026-07-26.' },
  )
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-24',
    format: 'date',
    description: 'Defaults to today.',
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'to must be a date like 2026-08-24.' },
  )
  to?: string;
}
