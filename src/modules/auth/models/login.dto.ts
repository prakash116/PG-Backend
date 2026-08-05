import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function normalizeIdentifier({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const identifier = value.trim();
  return identifier.includes('@') ? identifier.toLowerCase() : identifier;
}

export class LoginDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: 'Registered email address or phone number.',
  })
  @Transform(normalizeIdentifier)
  @IsString()
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[1-9]\d{7,14})$/, {
    message: 'Identifier must be a valid email address or phone number.',
  })
  identifier!: string;

  @ApiProperty({ example: 'Password@123', format: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
