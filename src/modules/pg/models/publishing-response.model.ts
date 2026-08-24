import { ApiProperty } from '@nestjs/swagger';
import { PlatformPaymentStatus } from '../../../generated/prisma/client';

/** The one-off listing fee attached to a PG. */
export class ListingFeeDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 100, description: 'Rupees.' })
  amount!: number;

  @ApiProperty({ enum: PlatformPaymentStatus })
  status!: PlatformPaymentStatus;

  @ApiProperty({
    example: 'UPI/425512345678',
    nullable: true,
    type: String,
    description: 'What the Super Admin matched the transfer against.',
  })
  reference!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  paidAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  requestedAt!: string;
}

export class PublishStatusDetail {
  @ApiProperty({ example: false })
  isPublished!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;

  @ApiProperty({ example: 100, description: 'What publishing costs, in rupees.' })
  feeRupees!: number;

  @ApiProperty({
    example: 'pzee@upi',
    description: 'Where to send the fee. Empty until SUPER_ADMIN_UPI_ID is set.',
  })
  payeeUpiId!: string;

  @ApiProperty({
    example: 'Demo Resident',
    nullable: true,
    type: String,
    description: 'The customer who referred this PG, if a code was given.',
  })
  referredBy!: string | null;

  @ApiProperty({
    type: ListingFeeDetail,
    nullable: true,
    description: 'Null until the owner has asked to publish.',
  })
  fee!: ListingFeeDetail | null;
}

export class PublishStatusResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Publish status retrieved.' })
  message!: string;

  @ApiProperty({ type: PublishStatusDetail })
  data!: PublishStatusDetail;
}

/** A fee waiting on a Super Admin, with everything needed to match the transfer. */
export class PendingFeeItem {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 100 })
  amount!: number;

  @ApiProperty({ format: 'date-time' })
  requestedAt!: string;

  @ApiProperty({ example: 'PZ-X6QQVD' })
  pgCode!: string;

  @ApiProperty({ example: 'Pzee Demo PG' })
  pgName!: string;

  @ApiProperty({ example: 'Pitampura, New Delhi' })
  pgLocation!: string;

  @ApiProperty({ example: 'Demo Owner' })
  ownerName!: string;

  @ApiProperty({ example: '9000000002' })
  ownerPhone!: string;

  @ApiProperty({ example: 'Demo Resident', nullable: true, type: String })
  referredByName!: string | null;

  @ApiProperty({ example: 'PZR-4F7K2A', nullable: true, type: String })
  referralCode!: string | null;

  @ApiProperty({
    example: 100,
    description: 'Credited to the referrer on confirmation. Zero if none.',
  })
  rewardRupees!: number;
}

export class PendingFeesResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Pending listing fees retrieved.' })
  message!: string;

  @ApiProperty({ type: [PendingFeeItem] })
  data!: PendingFeeItem[];
}
