import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserType } from '../../../generated/prisma/client';

export class LoginUserResponse {
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

  @ApiProperty({ example: '2026-08-05T12:30:00.000Z', format: 'date-time' })
  lastLogin!: string;
}

export class LoginDataResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ type: LoginUserResponse })
  user!: LoginUserResponse;
}

export class LoginResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Login successful.' })
  message!: 'Login successful.';

  @ApiProperty({ type: LoginDataResponse })
  data!: LoginDataResponse;
}
