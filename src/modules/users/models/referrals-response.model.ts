import { ApiProperty } from '@nestjs/swagger';
import { ReferralPayoutStatus } from '../../../generated/prisma/client';

/** One PG that went live from this customer's code, and what it earned them. */
export class ReferralRewardItem {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Sunrise Boys PG' })
  pgName!: string;

  @ApiProperty({ example: 'PZ-X6QQVD' })
  pgCode!: string;

  @ApiProperty({ example: 100, description: 'Rupees.' })
  amount!: number;

  @ApiProperty({ format: 'date-time' })
  earnedAt!: string;
}

/** Whether a ledger row put money in or took it out. */
export type ReferralTransactionKind = 'EARNED' | 'PAYOUT';

/**
 * One line of the customer's money history. Earnings and payouts share a shape
 * so the page can show them in a single, ordered list — which is how someone
 * actually reads a balance.
 */
export class ReferralTransaction {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ enum: ['EARNED', 'PAYOUT'], example: 'EARNED' })
  kind!: ReferralTransactionKind;

  @ApiProperty({
    example: 100,
    description: 'Always positive. `kind` says which direction it went.',
  })
  amount!: number;

  @ApiProperty({
    enum: ['EARNED', ...Object.values(ReferralPayoutStatus)],
    example: 'EARNED',
    description: 'EARNED for a credit; REQUESTED, PAID or REJECTED for a payout.',
  })
  status!: string;

  @ApiProperty({
    example: 'Sunrise Boys PG',
    description: 'The PG that earned it, or where a payout was sent.',
  })
  label!: string;

  @ApiProperty({
    example: 'PZ-X6QQVD',
    nullable: true,
    type: String,
    description: 'The PG code on an earning; null on a payout.',
  })
  reference!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Why a payout was rejected.',
  })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  at!: string;
}

export class ReferralsDetail {
  @ApiProperty({
    example: 'PZR-4F7K2A',
    nullable: true,
    type: String,
    description: 'Null for an account that is not a customer.',
  })
  referralCode!: string | null;

  @ApiProperty({ example: 300, description: 'Everything ever earned, in rupees.' })
  earnedRupees!: number;

  @ApiProperty({
    example: 100,
    description: 'Free to request. Earnings minus anything paid or requested.',
  })
  availableRupees!: number;

  @ApiProperty({ example: 100, description: 'Already sent to this customer.' })
  paidOutRupees!: number;

  @ApiProperty({
    example: 100,
    description: 'Requested and waiting on a Super Admin.',
  })
  pendingPayoutRupees!: number;

  @ApiProperty({
    example: 100,
    description: 'What one referred PG earns once it publishes.',
  })
  rewardPerReferral!: number;

  @ApiProperty({
    example: 1,
    description:
      'PGs that used this code but have not published yet, so nothing is earned from them.',
  })
  pendingReferrals!: number;

  @ApiProperty({
    example: false,
    description:
      'True while a payout is awaiting settlement. Only one may be open at a time.',
  })
  hasOpenPayout!: boolean;

  @ApiProperty({ type: [ReferralRewardItem] })
  rewards!: ReferralRewardItem[];

  @ApiProperty({
    type: [ReferralTransaction],
    description: 'Earnings and payouts together, newest first.',
  })
  transactions!: ReferralTransaction[];
}

export class ReferralsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Referrals retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: ReferralsDetail })
  data!: ReferralsDetail;
}
