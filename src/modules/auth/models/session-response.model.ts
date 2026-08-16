import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserType } from '../../../generated/prisma/client';

/** Safe user shape returned by login and by the session check. */
export class SessionUser {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe', nullable: true, type: String })
  lastName!: string | null;

  @ApiProperty({ example: 'john@gmail.com', format: 'email' })
  email!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ enum: UserType, nullable: true })
  userType!: UserType | null;

  @ApiProperty({ nullable: true, type: String })
  profileImage!: string | null;

  @ApiProperty({
    example: '2026-08-05T12:30:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  lastLogin!: string | null;
}

export class SessionResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Session is active.' })
  message!: 'Session is active.';

  @ApiProperty({ type: SessionUser })
  data!: SessionUser;
}
