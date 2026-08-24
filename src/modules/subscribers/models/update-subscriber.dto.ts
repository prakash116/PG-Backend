import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriberStatus } from '../../../generated/prisma/client';

export class UpdateSubscriberDto {
  @ApiProperty({
    enum: SubscriberStatus,
    example: SubscriberStatus.BLOCKED,
    description: 'BLOCKED stops the emails; ACTIVE starts them again.',
  })
  @IsEnum(SubscriberStatus, {
    message: 'Status must be either ACTIVE or BLOCKED.',
  })
  status!: SubscriberStatus;
}
