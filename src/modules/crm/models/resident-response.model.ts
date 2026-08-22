import { ApiProperty } from '@nestjs/swagger';
import {
  Gender,
  ResidentStatus,
  RoomType,
  UserType,
} from '../../../generated/prisma/client';

export class PaymentResponse {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 9800 })
  amount!: number;

  @ApiProperty({ example: '2026-08-22T00:00:00.000Z', format: 'date-time' })
  paidOn!: string;

  @ApiProperty({
    example: '2026-08-01T00:00:00.000Z',
    nullable: true,
    type: String,
  })
  forMonth!: string | null;

  @ApiProperty({ example: 'Paid by UPI', nullable: true, type: String })
  note!: string | null;
}

export class ResidentServiceResponse {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;

  @ApiProperty({ example: 3000, description: 'Charged monthly. 0 if included.' })
  monthlyAmount!: number;
}

export class ResidentDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Ananya Sharma' })
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiProperty({ example: '12 MG Road', nullable: true, type: String })
  address!: string | null;

  @ApiProperty({ enum: Gender, nullable: true })
  gender!: Gender | null;

  @ApiProperty({ enum: UserType, nullable: true })
  userType!: UserType | null;

  @ApiProperty({ enum: RoomType, description: 'The sharing type they are in.' })
  roomType!: RoomType;

  @ApiProperty({ example: 'cm1234567890', nullable: true, type: String })
  roomId!: string | null;

  @ApiProperty({
    example: '201',
    nullable: true,
    type: String,
    description: 'The room they are allocated.',
  })
  roomNumber!: string | null;

  @ApiProperty({ example: 9800, description: 'Rent, before services.' })
  monthlyRent!: number;

  @ApiProperty({ example: 3000, description: 'Services they take, per month.' })
  servicesTotal!: number;

  @ApiProperty({
    example: 12800,
    description: 'Rent plus services. This is what pending is measured against.',
  })
  monthlyTotal!: number;

  @ApiProperty({ type: [ResidentServiceResponse] })
  services!: ResidentServiceResponse[];

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({
    example: '2026-09-01T00:00:00.000Z',
    nullable: true,
    type: String,
  })
  dueDate!: string | null;

  @ApiProperty({ nullable: true, type: String })
  leftAt!: string | null;

  @ApiProperty({ enum: ResidentStatus })
  status!: ResidentStatus;

  @ApiProperty({
    example: 'cm1234567890',
    nullable: true,
    type: String,
    description:
      'The guest’s Pzee account, when their phone or email matched one.',
  })
  userId!: string | null;

  @ApiProperty({
    example: true,
    description: 'True when this guest also has a Pzee account.',
  })
  hasAccount!: boolean;

  @ApiProperty({ example: 29400, description: 'Paid so far, in total.' })
  totalPaid!: number;

  @ApiProperty({
    example: 9800,
    description: 'Rent owed for months elapsed, minus what has been paid.',
  })
  pendingAmount!: number;

  @ApiProperty({
    example: '2026-08-22T00:00:00.000Z',
    nullable: true,
    type: String,
    description: 'Most recent payment date; derived from the payment records.',
  })
  lastPaymentDate!: string | null;

  @ApiProperty({ type: [PaymentResponse] })
  payments!: PaymentResponse[];
}

export class ResidentListResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Guests retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [ResidentDetail] })
  data!: ResidentDetail[];
}

export class ResidentResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Guest saved successfully.' })
  message!: string;

  @ApiProperty({ type: ResidentDetail })
  data!: ResidentDetail;
}

export class RoomTypeOccupancy {
  @ApiProperty({ enum: RoomType })
  type!: RoomType;

  @ApiProperty({ example: 12 })
  totalBeds!: number;

  @ApiProperty({ example: 5 })
  occupiedBeds!: number;

  @ApiProperty({ example: 7 })
  availableBeds!: number;
}

export class CrmSummary {
  @ApiProperty({ example: 5, description: 'Guests staying right now.' })
  totalGuests!: number;

  @ApiProperty({ example: 19600, description: 'Owed across every active guest.' })
  pendingAmount!: number;

  @ApiProperty({ example: 49000, description: 'Collected within the period.' })
  collected!: number;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', format: 'date-time' })
  from!: string;

  @ApiProperty({ example: '2026-08-31T23:59:59.999Z', format: 'date-time' })
  to!: string;

  @ApiProperty({ example: 32 })
  totalBeds!: number;

  @ApiProperty({ example: 27 })
  availableBeds!: number;

  @ApiProperty({ type: [RoomTypeOccupancy] })
  occupancy!: RoomTypeOccupancy[];
}

export class CrmSummaryResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Summary retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: CrmSummary })
  data!: CrmSummary;
}
