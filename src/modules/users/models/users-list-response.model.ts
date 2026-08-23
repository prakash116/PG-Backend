import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserType } from '../../../generated/prisma/client';

export class UserListItemResponse {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe', nullable: true, type: String })
  lastName!: string | null;

  @ApiProperty({ example: 'user@pzee.in' })
  email!: string;

  @ApiProperty({ example: '9000000003' })
  phone!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({
    enum: UserType,
    example: UserType.STUDENT,
    nullable: true,
  })
  userType!: UserType | null;

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    nullable: true,
    type: String,
  })
  profileImage!: string | null;

  @ApiProperty({ example: 'Delhi' })
  state!: string | null;

  @ApiProperty({ example: 'New Delhi' })
  city!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    example: null,
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'Set when the account is closed and awaiting purge.',
  })
  deletedAt!: string | null;

  @ApiProperty({ example: '2026-08-05T10:30:00.000Z', format: 'date-time' })
  createdAt!: string;
}

export class UsersListResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Users retrieved successfully.' })
  message!: 'Users retrieved successfully.';

  @ApiProperty({ type: [UserListItemResponse] })
  data!: UserListItemResponse[];
}
