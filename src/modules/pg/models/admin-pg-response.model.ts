import { ApiProperty } from '@nestjs/swagger';
import {
  PgGender,
  PlatformPaymentStatus,
  ResidentStatus,
  RoomType,
  VerificationStatus,
} from '../../../generated/prisma/client';

/** One PG as it appears in the Super Admin list. */
export class AdminPgSummary {
  @ApiProperty({ example: 'PZ-X6QQVD' })
  pgCode!: string;

  @ApiProperty({ example: 'Sunrise Boys PG' })
  name!: string;

  @ApiProperty({ example: 'Kohat Enclave, Pitampura' })
  address!: string;

  @ApiProperty({ example: 'New Delhi', nullable: true, type: String })
  city!: string | null;

  @ApiProperty({ example: 'Demo Owner' })
  ownerName!: string;

  @ApiProperty({ example: '9000000002', description: 'The number to call.' })
  ownerPhone!: string;

  @ApiProperty({ nullable: true, type: String })
  logo!: string | null;

  @ApiProperty({ enum: PgGender, nullable: true })
  gender!: PgGender | null;

  @ApiProperty({ enum: VerificationStatus })
  verification!: VerificationStatus;

  @ApiProperty({
    example: true,
    description: 'False means it is hidden from the public site.',
  })
  isPublished!: boolean;

  @ApiProperty({
    enum: PlatformPaymentStatus,
    nullable: true,
    description: 'The ₹100 listing fee. Null when it has never been raised.',
  })
  membership!: PlatformPaymentStatus | null;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'When the listing fee was paid. Null while it is still due.',
  })
  membershipPaidAt!: string | null;

  @ApiProperty({ example: 16 })
  rooms!: number;

  @ApiProperty({ example: 32 })
  beds!: number;

  @ApiProperty({ example: 12, description: 'Residents living there now.' })
  residents!: number;

  @ApiProperty({ example: 96000, description: 'Rent collected, in rupees.' })
  revenue!: number;

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;
}

export class AdminPgListResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'PGs retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminPgSummary] })
  data!: AdminPgSummary[];
}

/** One month of collections, for the revenue chart. */
export class RevenuePoint {
  @ApiProperty({ example: '2026-08' })
  month!: string;

  @ApiProperty({ example: 24000 })
  amount!: number;
}

export class AdminPgRoom {
  @ApiProperty({ example: '101' })
  number!: string;

  @ApiProperty({ enum: RoomType })
  type!: RoomType;

  @ApiProperty({ example: 2 })
  totalBeds!: number;

  @ApiProperty({ example: 1 })
  occupiedBeds!: number;
}

export class AdminPgRoomType {
  @ApiProperty({ enum: RoomType })
  type!: RoomType;

  @ApiProperty({ example: 8000 })
  pricePerBed!: number;

  @ApiProperty({ example: 6 })
  rooms!: number;
}

export class AdminPgResident {
  @ApiProperty({ example: 'Aarav Sharma' })
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiProperty({ example: '101', nullable: true, type: String })
  roomNumber!: string | null;

  @ApiProperty({ enum: RoomType })
  roomType!: RoomType;

  @ApiProperty({ example: 8000 })
  monthlyRent!: number;

  @ApiProperty({ enum: ResidentStatus })
  status!: ResidentStatus;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  dueDate!: string | null;
}

/** Everything behind one PG: its rooms, its guests and what it has collected. */
export class AdminPgDetail extends AdminPgSummary {
  @ApiProperty({ example: 'A quiet PG close to the metro.', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: ['Wifi', 'Laundry'], type: [String] })
  amenities!: string[];

  @ApiProperty({ type: [String] })
  images!: string[];

  @ApiProperty({ example: 'owner@pzee.in' })
  ownerEmail!: string;

  @ApiProperty({ example: 20, description: 'Beds free right now.' })
  availableBeds!: number;

  @ApiProperty({ type: [AdminPgRoomType] })
  roomTypes!: AdminPgRoomType[];

  @ApiProperty({ type: [AdminPgRoom] })
  roomList!: AdminPgRoom[];

  @ApiProperty({ type: [AdminPgResident] })
  residentList!: AdminPgResident[];

  @ApiProperty({
    type: [RevenuePoint],
    description: 'The last 12 months of rent collected, oldest first.',
  })
  revenueByMonth!: RevenuePoint[];
}

export class AdminPgDetailResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'PG retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: AdminPgDetail })
  data!: AdminPgDetail;
}

export class AdminPgActionResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sunrise Boys PG is verified.' })
  message!: string;

  @ApiProperty({ type: AdminPgSummary })
  data!: AdminPgSummary;
}
