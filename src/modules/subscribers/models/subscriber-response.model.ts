import { ApiProperty } from '@nestjs/swagger';
import { SubscriberStatus } from '../../../generated/prisma/client';

export class SubscriberDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'you@example.com' })
  email!: string;

  @ApiProperty({ enum: SubscriberStatus, example: SubscriberStatus.ACTIVE })
  status!: SubscriberStatus;

  @ApiProperty({ format: 'date-time' })
  subscribedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  blockedAt!: string | null;
}

export class SubscribersListResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Subscribers retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [SubscriberDetail] })
  data!: SubscriberDetail[];
}

export class SubscriberResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Subscriber updated.' })
  message!: string;

  @ApiProperty({ type: SubscriberDetail })
  data!: SubscriberDetail;
}

/**
 * The public reply. It carries no record back: whether an address is on the
 * list, or blocked, is not something an anonymous form should be able to probe.
 */
export class SubscribeResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: "You're subscribed. PG updates are on their way." })
  message!: string;
}
