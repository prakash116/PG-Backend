import { ApiProperty } from '@nestjs/swagger';

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

export class ReferralsDetail {
  @ApiProperty({
    example: 'PZR-4F7K2A',
    nullable: true,
    type: String,
    description: 'Null for an account that is not a customer.',
  })
  referralCode!: string | null;

  @ApiProperty({ example: 100, description: 'Everything earned so far, in rupees.' })
  earnedRupees!: number;

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

  @ApiProperty({ type: [ReferralRewardItem] })
  rewards!: ReferralRewardItem[];
}

export class ReferralsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Referrals retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: ReferralsDetail })
  data!: ReferralsDetail;
}
