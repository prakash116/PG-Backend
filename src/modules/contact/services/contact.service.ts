/** Messages sent from the public Contact Us form. */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContactEnquiryStatus } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { ContactEnquiryDetail } from '../models/contact-response.model';
import { CreateEnquiryDto } from '../models/contact.dto';

const ENQUIRY_SELECT = {
  id: true,
  name: true,
  phone: true,
  reason: true,
  description: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
} as const;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Anyone sending a message from the website. */
  async create(dto: CreateEnquiryDto): Promise<void> {
    await this.databaseService.contactEnquiry.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        reason: dto.reason,
        description: dto.description,
      },
      select: { id: true },
    });

    this.logger.log(`Contact enquiry from ${dto.phone}: ${dto.reason}`);
  }

  /**
   * Every enquiry, for a Super Admin. New ones first — those are the ones that
   * need answering, and sorting purely by date buries them under old ones.
   */
  async list(): Promise<ContactEnquiryDetail[]> {
    const enquiries = await this.databaseService.contactEnquiry.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: ENQUIRY_SELECT,
    });

    return enquiries.map(present);
  }

  /** Super Admin: this one has been dealt with. */
  async resolve(id: string, adminId: string): Promise<ContactEnquiryDetail> {
    const existing = await this.databaseService.contactEnquiry.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('That enquiry no longer exists.');
    }

    if (existing.status === ContactEnquiryStatus.RESOLVED) {
      throw new ConflictException('That enquiry is already resolved.');
    }

    const enquiry = await this.databaseService.contactEnquiry.update({
      where: { id },
      data: {
        status: ContactEnquiryStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
      select: ENQUIRY_SELECT,
    });

    return present(enquiry);
  }

  /** Super Admin: remove an enquiry for good. */
  async remove(id: string): Promise<ContactEnquiryDetail> {
    const enquiry = await this.databaseService.contactEnquiry.findUnique({
      where: { id },
      select: ENQUIRY_SELECT,
    });

    if (!enquiry) {
      throw new NotFoundException('That enquiry no longer exists.');
    }

    await this.databaseService.contactEnquiry.delete({ where: { id } });

    return present(enquiry);
  }
}

function present(enquiry: {
  id: string;
  name: string;
  phone: string;
  reason: string;
  description: string;
  status: ContactEnquiryStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}): ContactEnquiryDetail {
  return {
    id: enquiry.id,
    name: enquiry.name,
    phone: enquiry.phone,
    reason: enquiry.reason,
    description: enquiry.description,
    status: enquiry.status,
    sentAt: enquiry.createdAt.toISOString(),
    resolvedAt: enquiry.resolvedAt ? enquiry.resolvedAt.toISOString() : null,
  };
}
