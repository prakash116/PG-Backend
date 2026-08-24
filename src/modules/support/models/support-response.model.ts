import { ApiProperty } from '@nestjs/swagger';
import { SupportTicketStatus } from '../../../generated/prisma/client';

/** A query as its owner sees it: what they asked, and what came back. */
export class SupportTicketDetail {
  @ApiProperty({ example: 'cm1234567890' })
  id!: string;

  @ApiProperty({ example: 'Cannot upload room photos' })
  title!: string;

  @ApiProperty({ example: 'The upload spins and then fails.' })
  message!: string;

  @ApiProperty({ enum: SupportTicketStatus, example: SupportTicketStatus.OPEN })
  status!: SupportTicketStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What Pzee replied. Null while the query is still open.',
  })
  response!: string | null;

  @ApiProperty({ format: 'date-time' })
  raisedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  resolvedAt!: string | null;
}

/** The same query with the context a Super Admin needs to answer it. */
export class AdminSupportTicketDetail extends SupportTicketDetail {
  @ApiProperty({ example: 'Sunrise Boys PG' })
  pgName!: string;

  @ApiProperty({ example: 'PZ-X6QQVD' })
  pgCode!: string;

  @ApiProperty({ example: 'Demo Owner' })
  ownerName!: string;

  @ApiProperty({ example: '9000000002', description: 'The number to call back.' })
  ownerPhone!: string;
}

export class SupportTicketsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Queries retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [SupportTicketDetail] })
  data!: SupportTicketDetail[];
}

export class AdminSupportTicketsResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Queries retrieved successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminSupportTicketDetail] })
  data!: AdminSupportTicketDetail[];
}

export class SupportTicketResponse {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Query raised.' })
  message!: string;

  @ApiProperty({ type: SupportTicketDetail })
  data!: SupportTicketDetail;
}
