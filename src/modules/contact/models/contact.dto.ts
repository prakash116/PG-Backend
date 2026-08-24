import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsMobilePhone,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** What the public Contact Us form sends. */
export class CreateEnquiryDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @Transform(trimString)
  @MinLength(2, { message: 'Enter your name.' })
  @MaxLength(100)
  @IsNotEmpty({ message: 'Enter your name.' })
  @IsString({ message: 'Enter your name.' })
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @Transform(trimString)
  @IsMobilePhone(undefined, undefined, {
    message: 'Enter a valid mobile number.',
  })
  phone!: string;

  @ApiProperty({
    example: 'Problem with a booking',
    description: 'What the message is about, in the sender’s own words.',
  })
  @Transform(trimString)
  @MinLength(3, { message: 'Tell us what this is about.' })
  @MaxLength(120)
  @IsNotEmpty({ message: 'Tell us what this is about.' })
  @IsString({ message: 'Tell us what this is about.' })
  reason!: string;

  @ApiProperty({
    example: 'I booked a visit last week and nobody has called back.',
  })
  @Transform(trimString)
  @MinLength(10, { message: 'Describe it in at least 10 characters.' })
  @MaxLength(2000)
  @IsNotEmpty({ message: 'Describe what you need help with.' })
  @IsString({ message: 'Describe what you need help with.' })
  description!: string;
}
