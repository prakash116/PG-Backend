import { ApiProperty } from '@nestjs/swagger';
import {
  PgGender,
  RoomType,
  VerificationStatus,
} from '../../../generated/prisma/client';

/** The PG a resident is living in, from the resident's side of the table. */
export class StayPgSummary {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'PZ-X6QQVD' })
  pgCode!: string;

  @ApiProperty({ example: 'Pzee Demo PG' })
  name!: string;

  @ApiProperty({ example: 'Pitampura, New Delhi 110034' })
  location!: string;

  @ApiProperty({ example: 'New Delhi', nullable: true, type: String })
  city!: string | null;

  @ApiProperty({ nullable: true, type: String })
  logo!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'First listing photo, for the header of the card.',
  })
  image!: string | null;

  @ApiProperty({ enum: PgGender, nullable: true })
  gender!: PgGender | null;

  @ApiProperty({ example: true })
  foodIncluded!: boolean;

  @ApiProperty({ enum: VerificationStatus })
  verification!: VerificationStatus;

  @ApiProperty({ example: 'Demo Owner' })
  ownerName!: string;

  @ApiProperty({
    example: '9000000002',
    description: 'So a resident can reach the person who runs their PG.',
  })
  ownerPhone!: string;
}

export class StayServiceItem {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Laundry' })
  name!: string;

  @ApiProperty({ example: 500 })
  monthlyAmount!: number;
}

export class StayDetail {
  @ApiProperty({ example: 'cm1234567890' })
  residentId!: string;

  @ApiProperty({ example: '101', nullable: true, type: String })
  roomNumber!: string | null;

  @ApiProperty({ enum: RoomType, example: RoomType.DOUBLE })
  roomType!: RoomType;

  @ApiProperty({ example: 8000, description: 'Rent only, in rupees.' })
  monthlyRent!: number;

  @ApiProperty({
    example: 8500,
    description: 'Rent plus every service they have taken.',
  })
  monthlyTotal!: number;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z', format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({
    example: '2026-09-01T00:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  dueDate!: string | null;

  @ApiProperty({ type: [StayServiceItem] })
  services!: StayServiceItem[];

  @ApiProperty({ type: StayPgSummary })
  pg!: StayPgSummary;
}

export class StayResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stay retrieved successfully.' })
  message!: string;

  @ApiProperty({
    type: StayDetail,
    nullable: true,
    description:
      'Null when the account is not currently a resident anywhere — which is the normal state for someone still looking.',
  })
  data!: StayDetail | null;
}
