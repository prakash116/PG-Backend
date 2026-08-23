import { ApiProperty } from '@nestjs/swagger';

/** An account that has been closed, and when it stops being recoverable. */
export class ClosedAccount {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Demo Resident' })
  name!: string;

  @ApiProperty({ example: 'user@pzee.in' })
  email!: string;

  @ApiProperty({
    example: '2026-08-23T09:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'Null once the account has been restored.',
  })
  deletedAt!: string | null;

  @ApiProperty({
    example: '2026-09-22T09:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'The date the row is removed for good.',
  })
  purgeOn!: string | null;

  @ApiProperty({ example: 30 })
  graceDays!: number;
}

export class CloseAccountResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account closed.' })
  message!: string;

  @ApiProperty({ type: ClosedAccount })
  data!: ClosedAccount;
}
