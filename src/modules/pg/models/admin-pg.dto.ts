import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '../../../generated/prisma/client';

/**
 * The two switches a Super Admin has over a listing. Both optional: the admin
 * page sends whichever one the button changed, and leaves the other alone.
 */
export class AdminUpdatePgDto {
  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: 'The Pzee Verified badge. Only a Super Admin may set this.',
  })
  @IsOptional()
  @IsEnum(VerificationStatus, {
    message: 'Verification must be PENDING, VERIFIED or REJECTED.',
  })
  verification?: VerificationStatus;

  @ApiPropertyOptional({
    example: false,
    description:
      'False hides the PG from the public site. The owner keeps their dashboard, rooms and guests.',
  })
  @IsOptional()
  @IsBoolean({ message: 'isPublished must be true or false.' })
  isPublished?: boolean;
}
