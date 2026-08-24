import { ApiProperty } from '@nestjs/swagger';

/** One day on the sign-ups chart. */
export class SignupPoint {
  @ApiProperty({ example: '2026-08-24', format: 'date' })
  date!: string;

  @ApiProperty({ example: 3, description: 'Customers who joined that day.' })
  customers!: number;

  @ApiProperty({ example: 1, description: 'PG owners who joined that day.' })
  owners!: number;

  @ApiProperty({
    example: 42,
    description:
      'Everyone on the platform by the end of that day, so the line climbs rather than jitters around zero.',
  })
  total!: number;
}

export class UserStatsDetail {
  @ApiProperty({ example: '2026-07-26', format: 'date' })
  from!: string;

  @ApiProperty({ example: '2026-08-24', format: 'date' })
  to!: string;

  @ApiProperty({ example: 11, description: 'Accounts on the platform now.' })
  totalAccounts!: number;

  @ApiProperty({ example: 5 })
  totalCustomers!: number;

  @ApiProperty({ example: 3 })
  totalOwners!: number;

  @ApiProperty({ example: 4, description: 'Joined inside the range.' })
  joinedInRange!: number;

  @ApiProperty({
    type: [SignupPoint],
    description: 'One entry per day in the range, including the empty ones.',
  })
  series!: SignupPoint[];
}

export class UserStatsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Sign-up stats retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: UserStatsDetail })
  data!: UserStatsDetail;
}
