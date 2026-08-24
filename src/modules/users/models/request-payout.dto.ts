import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * A UPI id, e.g. `name@okhdfcbank`. Deliberately permissive about the handle
 * because banks keep adding new ones — what matters is that there is something
 * either side of a single `@`, so an admin has an address to pay.
 */
const UPI_ID_PATTERN = /^[\w.\-]{2,64}@[A-Za-z]{2,32}$/;

function normalizeUpiId({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RequestPayoutDto {
  @ApiProperty({
    example: 'aarav@okhdfcbank',
    description: 'Where the money should be sent.',
  })
  @Transform(normalizeUpiId)
  @MaxLength(100)
  @Matches(UPI_ID_PATTERN, {
    message: 'Enter a valid UPI id, like name@okhdfcbank.',
  })
  @IsString({ message: 'Enter the UPI id to send your payout to.' })
  upiId!: string;
}
