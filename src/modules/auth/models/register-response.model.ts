import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserType } from '../../../generated/prisma/client';

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

  @ApiProperty({ example: '2026-08-05T10:30:00.000Z', format: 'date-time' })
  createdAt!: string;
}

export class RegisterResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Registration successful.' })
  message!: 'Registration successful.';

  @ApiProperty({ type: RegisteredUserResponse })
  data!: RegisteredUserResponse;
}
