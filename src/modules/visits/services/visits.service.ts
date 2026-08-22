import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VisitStatus } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { CreateVisitDto, ListVisitsQuery } from '../models/visit.dto';

/** A visit already asked for and not yet dealt with. */
const OPEN_STATUSES: VisitStatus[] = ['PENDING', 'CONFIRMED'];

export interface VisitDetail {
  id: string;
  pgCode: string;
  pgName: string;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string | null;
  message: string | null;
  status: VisitStatus;
  requestedAt: string;
}

const VISIT_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  preferredDate: true,
  message: true,
  status: true,
  createdAt: true,
  pg: { select: { pgCode: true, name: true } },
} as const;

type VisitRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: Date | null;
  message: string | null;
  status: VisitStatus;
  createdAt: Date;
  pg: { pgCode: string; name: string };
};

@Injectable()
export class VisitsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Books a visit for the signed-in customer. Their name, phone and email are
   * copied from their account, so the owner always receives real contact
   * details and the customer never retypes them.
   */
  async book(userId: string, dto: CreateVisitDto): Promise<VisitDetail> {
    const pg = await this.databaseService.pg.findUnique({
      where: { pgCode: dto.pgCode },
      select: { id: true, ownerId: true },
    });

    if (!pg) {
      throw new NotFoundException('No PG found for that ID.');
    }

    if (pg.ownerId === userId) {
      throw new BadRequestException('You cannot book a visit to your own PG.');
    }

    const user = await this.databaseService.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });

    const alreadyOpen = await this.databaseService.visitRequest.findFirst({
      where: { pgId: pg.id, userId, status: { in: OPEN_STATUSES } },
      select: { id: true },
    });

    if (alreadyOpen) {
      throw new BadRequestException(
        'You already have a visit booked for this PG.',
      );
    }

    const visit = await this.databaseService.visitRequest.create({
      data: {
        pgId: pg.id,
        userId,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
        phone: user.phone,
        email: user.email,
        preferredDate: dto.preferredDate
          ? new Date(dto.preferredDate)
          : undefined,
        message: dto.message,
      },
      select: VISIT_SELECT,
    });

    return this.present(visit as VisitRow);
  }

  /** What the signed-in customer has booked, across every PG. */
  async listForCustomer(userId: string): Promise<VisitDetail[]> {
    const visits = await this.databaseService.visitRequest.findMany({
      where: { userId },
      select: VISIT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return visits.map((visit) => this.present(visit as VisitRow));
  }

  /** What has been asked of the signed-in owner's PG. */
  async listForOwner(
    ownerId: string,
    query: ListVisitsQuery,
  ): Promise<VisitDetail[]> {
    const pgId = await this.pgIdOf(ownerId);

    const visits = await this.databaseService.visitRequest.findMany({
      where: { pgId, ...(query.status && { status: query.status }) },
      select: VISIT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return visits.map((visit) => this.present(visit as VisitRow));
  }

  async updateStatus(
    ownerId: string,
    visitId: string,
    status: VisitStatus,
  ): Promise<VisitDetail> {
    const pgId = await this.pgIdOf(ownerId);

    // Scoped to the owner's PG, so another PG's request reads as missing.
    const existing = await this.databaseService.visitRequest.findFirst({
      where: { id: visitId, pgId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Visit request not found.');
    }

    const visit = await this.databaseService.visitRequest.update({
      where: { id: visitId },
      data: { status },
      select: VISIT_SELECT,
    });

    return this.present(visit as VisitRow);
  }

  private async pgIdOf(ownerId: string): Promise<string> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: { id: true },
    });

    if (!pg) {
      throw new NotFoundException('No PG is linked to this account yet.');
    }

    return pg.id;
  }

  private present(visit: VisitRow): VisitDetail {
    return {
      id: visit.id,
      pgCode: visit.pg.pgCode,
      pgName: visit.pg.name,
      fullName: visit.fullName,
      phone: visit.phone,
      email: visit.email,
      preferredDate: visit.preferredDate
        ? visit.preferredDate.toISOString()
        : null,
      message: visit.message,
      status: visit.status,
      requestedAt: visit.createdAt.toISOString(),
    };
  }
}
