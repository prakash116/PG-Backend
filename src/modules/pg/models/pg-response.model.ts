import { ApiProperty } from '@nestjs/swagger';
import {
  Cooling,
  PgGender,
  RoomType,
  VerificationStatus,
} from '../../../generated/prisma/client';

export class PgRoomTypeResponse {
  @ApiProperty({ enum: RoomType, example: RoomType.DOUBLE })
  type!: RoomType;

  @ApiProperty({ example: 6 })
  roomCount!: number;

  @ApiProperty({ example: 9800 })
  pricePerBed!: number;

  @ApiProperty({ example: 12, description: 'Derived from roomCount.' })
  totalBeds!: number;

  @ApiProperty({ example: 4 })
  availableBeds!: number;
}

/** Rolled up so the dashboard and listing cards agree on one set of numbers. */
export class PgTotalsResponse {
  @ApiProperty({ example: 14 })
  rooms!: number;

  @ApiProperty({ example: 28 })
  beds!: number;

  @ApiProperty({ example: 9 })
  availableBeds!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}

/** Drives the dashboard progress meter. */
export class PgCompletionResponse {
  @ApiProperty({ example: 75 })
  percent!: number;

  @ApiProperty({
    example: ['Photos', 'Rooms and pricing'],
    type: [String],
    description: 'Human-readable names of the sections still to fill in.',
  })
  missing!: string[];
}

export class PgDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'PZ-4F7K2A' })
  pgCode!: string;

  @ApiProperty({ example: 'Sunrise Boys PG' })
  name!: string;

  @ApiProperty({ example: 'Kohat Enclave, Pitampura' })
  location!: string;

  @ApiProperty({ example: 'New Delhi', nullable: true, type: String })
  city!: string | null;

  @ApiProperty({ example: 'Airy rooms…', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: 8500, nullable: true, type: Number })
  price!: number | null;

  @ApiProperty({ example: 15000, nullable: true, type: Number })
  deposit!: number | null;

  @ApiProperty({ enum: PgGender, nullable: true })
  gender!: PgGender | null;

  @ApiProperty({ enum: Cooling, nullable: true })
  cooling!: Cooling | null;

  @ApiProperty({ example: true })
  foodIncluded!: boolean;

  @ApiProperty({ example: 'Three meals a day.', nullable: true, type: String })
  foodDetails!: string | null;

  @ApiProperty({ example: ['WiFi', 'Laundry'], type: [String] })
  amenities!: string[];

  @ApiProperty({ type: [String] })
  images!: string[];

  @ApiProperty({
    enum: VerificationStatus,
    example: VerificationStatus.PENDING,
    description: 'Set by a Super Admin. Read-only for owners.',
  })
  verification!: VerificationStatus;

  @ApiProperty({ example: true, description: 'True when verification is VERIFIED.' })
  verified!: boolean;

  @ApiProperty({ example: 4.6, description: 'Average rating; 0 until rated.' })
  rating!: number;

  @ApiProperty({ example: 132 })
  reviewCount!: number;

  @ApiProperty({ type: [PgRoomTypeResponse] })
  roomTypes!: PgRoomTypeResponse[];

  @ApiProperty({ type: PgTotalsResponse })
  totals!: PgTotalsResponse;

  @ApiProperty({ type: PgCompletionResponse })
  completion!: PgCompletionResponse;

  @ApiProperty({ example: '2026-08-22T10:30:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class PgResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'PG retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: PgDetail })
  data!: PgDetail;
}
