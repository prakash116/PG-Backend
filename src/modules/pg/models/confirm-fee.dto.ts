import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ConfirmFeeDto {
  @ApiPropertyOptional({
    example: 'UPI/425512345678',
    description:
      'The transfer reference, so the confirmation can be matched to a bank entry later.',
  })
  @Transform(trimString)
  @IsOptional()
  @MaxLength(120)
  @IsString()
  reference?: string;
}
