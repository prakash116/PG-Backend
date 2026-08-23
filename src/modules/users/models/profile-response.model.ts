import { ApiProperty } from '@nestjs/swagger';
import {
  Gender,
  UserRole,
  UserType,
} from '../../../generated/prisma/client';

/**
 * The full account, as opposed to the trimmed-down session user that
 * `GET /v1/auth/me` returns for the header. `password` is not a field here and
 * never will be.
 */
export class ProfileDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Aarav' })
  firstName!: string;

  @ApiProperty({ example: 'Sharma', nullable: true, type: String })
  lastName!: string | null;

  @ApiProperty({ example: 'aarav@gmail.com' })
  email!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ enum: UserType, example: UserType.STUDENT, nullable: true })
  userType!: UserType | null;

  @ApiProperty({ enum: Gender, example: Gender.MALE, nullable: true })
  gender!: Gender | null;

  @ApiProperty({
    example: '2001-05-12',
    format: 'date',
    nullable: true,
    type: String,
    description: 'Date only, so it cannot shift across a timezone boundary.',
  })
  dateOfBirth!: string | null;

  @ApiProperty({
    example: '/uploads/profile/8f2c1d.webp',
    nullable: true,
    type: String,
  })
  profileImage!: string | null;

  @ApiProperty({ example: 'Laxmi Nagar, New Delhi', nullable: true, type: String })
  address!: string | null;

  @ApiProperty({ example: 'New Delhi', nullable: true, type: String })
  city!: string | null;

  @ApiProperty({ example: 'Delhi', nullable: true, type: String })
  state!: string | null;

  @ApiProperty({ example: 'India', nullable: true, type: String })
  country!: string | null;

  @ApiProperty({ example: '110092', nullable: true, type: String })
  pincode!: string | null;

  @ApiProperty({ example: false })
  isEmailVerified!: boolean;

  @ApiProperty({ example: false })
  isPhoneVerified!: boolean;

  @ApiProperty({ example: '2026-08-05T10:30:00.000Z', format: 'date-time' })
  createdAt!: string;
}

export class ProfileResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Profile retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: ProfileDetail })
  data!: ProfileDetail;
}
