import { ApiProperty } from '@nestjs/swagger';
import { ContactEnquiryStatus } from '../../../generated/prisma/client';

export class ContactEnquiryDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Aarav Sharma' })
  name!: string;

  @ApiProperty({ example: '9876543210' })
  phone!: string;

  @ApiProperty({ example: 'Problem with a booking' })
  reason!: string;

  @ApiProperty({ example: 'I booked a visit and nobody called back.' })
  description!: string;

  @ApiProperty({ enum: ContactEnquiryStatus, example: ContactEnquiryStatus.NEW })
  status!: ContactEnquiryStatus;

  @ApiProperty({ format: 'date-time' })
  sentAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  resolvedAt!: string | null;
}

export class ContactEnquiriesResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Enquiries retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [ContactEnquiryDetail] })
  data!: ContactEnquiryDetail[];
}

export class ContactEnquiryResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Marked resolved.' })
  message!: string;

  @ApiProperty({ type: ContactEnquiryDetail })
  data!: ContactEnquiryDetail;
}

/**
 * The public reply. It carries no record back — a form open to the internet
 * should not hand anything out.
 */
export class EnquirySentResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Thanks — we have your message and will call you back.' })
  message!: string;
}
