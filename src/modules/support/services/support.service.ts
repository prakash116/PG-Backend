/** Support queries a PG owner raises, and a Super Admin answers. */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupportTicketStatus } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  AdminSupportTicketDetail,
  SupportTicketDetail,
} from '../models/support-response.model';
import { RaiseTicketDto, ResolveTicketDto } from '../models/support.dto';

const TICKET_SELECT = {
  id: true,
  title: true,
  message: true,
  status: true,
  response: true,
  createdAt: true,
  resolvedAt: true,
} as const;

const ADMIN_TICKET_SELECT = {
  ...TICKET_SELECT,
  pg: {
    select: {
      name: true,
      pgCode: true,
      owner: { select: { firstName: true, lastName: true, phone: true } },
    },
  },
} as const;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** The owner raising a query from their dashboard. */
  async raise(
    ownerId: string,
    dto: RaiseTicketDto,
  ): Promise<SupportTicketDetail> {
    const pgId = await this.pgIdOf(ownerId);

    const ticket = await this.databaseService.supportTicket.create({
      data: { pgId, title: dto.title, message: dto.message },
      select: TICKET_SELECT,
    });

    this.logger.log(`Support query raised for PG ${pgId}: ${dto.title}`);

    return present(ticket);
  }

  /** The owner's own queries, newest first. */
  async listForOwner(ownerId: string): Promise<SupportTicketDetail[]> {
    const pgId = await this.pgIdOf(ownerId);

    const tickets = await this.databaseService.supportTicket.findMany({
      where: { pgId },
      orderBy: { createdAt: 'desc' },
      select: TICKET_SELECT,
    });

    return tickets.map(present);
  }

  /**
   * Every query, for a Super Admin. Open ones first — those are the ones that
   * need doing, and sorting purely by date buries them under old answered ones.
   */
  async listForAdmin(): Promise<AdminSupportTicketDetail[]> {
    const tickets = await this.databaseService.supportTicket.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: ADMIN_TICKET_SELECT,
    });

    return tickets.map((ticket) => ({
      ...present(ticket),
      pgName: ticket.pg.name,
      pgCode: ticket.pg.pgCode,
      ownerName: [ticket.pg.owner.firstName, ticket.pg.owner.lastName]
        .filter(Boolean)
        .join(' '),
      ownerPhone: ticket.pg.owner.phone,
    }));
  }

  /** Super Admin: mark a query solved or rejected, with a reply. */
  async resolve(
    id: string,
    adminId: string,
    dto: ResolveTicketDto,
  ): Promise<SupportTicketDetail> {
    const existing = await this.databaseService.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException('That query no longer exists.');
    }

    if (existing.status !== SupportTicketStatus.OPEN) {
      throw new ConflictException('That query has already been answered.');
    }

    const ticket = await this.databaseService.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        response: dto.response?.trim() || null,
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
      select: TICKET_SELECT,
    });

    return present(ticket);
  }

  /** Super Admin: remove a query for good. */
  async remove(id: string): Promise<SupportTicketDetail> {
    const ticket = await this.databaseService.supportTicket.findUnique({
      where: { id },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException('That query no longer exists.');
    }

    await this.databaseService.supportTicket.delete({ where: { id } });

    return present(ticket);
  }

  /**
   * Queries belong to a PG, and an owner has exactly one. Resolving it from the
   * session is what stops an owner reading or answering anyone else's.
   */
  private async pgIdOf(ownerId: string): Promise<string> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: { id: true },
    });

    if (!pg) {
      throw new NotFoundException('No PG is registered to this account.');
    }

    return pg.id;
  }
}

function present(ticket: {
  id: string;
  title: string;
  message: string;
  status: SupportTicketStatus;
  response: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}): SupportTicketDetail {
  return {
    id: ticket.id,
    title: ticket.title,
    message: ticket.message,
    status: ticket.status,
    response: ticket.response,
    raisedAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
  };
}
