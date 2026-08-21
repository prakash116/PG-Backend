import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserType } from '../../../generated/prisma/client';

/** The PG created alongside a PG_OWNER registration. */
export class RegisteredPgResponse {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({
    example: 'PZ-4F7K2A',
    description: 'Unique PG identifier the owner can share.',
  })
  pgCode!: string;

  @ApiProperty({ example: 'Sunrise Boys PG' })
  name!: string;

  @ApiProperty({ example: 'Kohat Enclave, Pitampura, Delhi' })
  location!: string;
}

export class RegisteredUserResponse {
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

  @ApiProperty({ enum: UserRole, example: UserRole.PG_OWNER })
  role!: UserRole;

  @ApiProperty({
    enum: UserType,
    example: UserType.WORKING_PROFESSIONAL,
    nullable: true,
  })
  userType!: UserType | null;

  @ApiProperty({
    example: '/uploads/profile/8f2c1d.webp',
    nullable: true,
    type: String,
  })
  profileImage!: string | null;

  @ApiProperty({ example: '2026-08-05T10:30:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    type: RegisteredPgResponse,
    nullable: true,
    description: 'Present only when the account was registered as a PG owner.',
  })
  pg!: RegisteredPgResponse | null;
}

export class RegisterResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Registration successful.' })
  message!: 'Registration successful.';

  @ApiProperty({ type: RegisteredUserResponse })
  data!: RegisteredUserResponse;
}
