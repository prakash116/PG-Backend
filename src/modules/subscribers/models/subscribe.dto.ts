import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class SubscribeDto {
  @ApiProperty({ example: 'you@example.com', format: 'email' })
  @Transform(normalizeEmail)
  @MaxLength(254)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}
