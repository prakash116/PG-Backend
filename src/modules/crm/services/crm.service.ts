import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  CreatePaymentDto,
  CreateResidentDto,
  CrmSummaryQuery,
  ListResidentsQuery,
  UpdateResidentDto,
} from '../models/resident.dto';
import {
  CrmSummary,
  ResidentDetail,
  RoomTypeOccupancy,
} from '../models/resident-response.model';

/** How many beds a room of each type holds. Mirrors PgService. */
const BEDS_PER_ROOM: Record<RoomType, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  PREMIUM: 1,
};

const RESIDENT_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  address: true,
  gender: true,
  userType: true,
  roomType: true,
  roomId: true,
  room: { select: { id: true, number: true } },
  monthlyRent: true,
  joinedAt: true,
  dueDate: true,
  leftAt: true,
  status: true,
  userId: true,
  payments: {
    select: { id: true, amount: true, paidOn: true, forMonth: true, note: true },
    orderBy: { paidOn: 'desc' },
  },
  services: {
    select: { id: true, name: true, monthlyAmount: true },
    orderBy: { name: 'asc' },
  },
} as const;

type ResidentRow = {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  gender: ResidentDetail['gender'];
  userType: ResidentDetail['userType'];
  roomType: RoomType;
  roomId: string | null;
  room: { id: string; number: string } | null;
  monthlyRent: number;
  joinedAt: Date;
  dueDate: Date | null;
  leftAt: Date | null;
  status: ResidentDetail['status'];
  userId: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paidOn: Date;
    forMonth: Date | null;
    note: string | null;
  }>;
  services: Array<{ id: string; name: string; monthlyAmount: number }>;
};

/** Whole months from `start` up to `end`, counting the first as due on arrival. */
function monthsElapsed(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 1 : 0);

  return Math.max(1, months);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

@Injectable()
export class CrmService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(
    ownerId: string,
    query: ListResidentsQuery,
  ): Promise<ResidentDetail[]> {
    const pgId = await this.pgIdOf(ownerId);
    const search = query.search?.trim();

    const residents = await this.databaseService.resident.findMany({
      where: {
        pgId,
        status: query.status ?? 'ACTIVE',
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }),
      },
      select: RESIDENT_SELECT,
      orderBy: { joinedAt: 'desc' },
    });

    return residents.map((resident) => this.present(resident as ResidentRow));
  }

  async create(
    ownerId: string,
    dto: CreateResidentDto,
  ): Promise<ResidentDetail> {
    const pgId = await this.pgIdOf(ownerId);

    await this.assertBedAvailable(pgId, dto.roomType);

    if (dto.roomId) {
      await this.assertRoomHasBed(pgId, dto.roomId);
    }

    const resident = await this.databaseService.resident.create({
      data: {
        pgId,
        fullName: dto.fullName,
        phone: dto.phone,
        address: dto.address,
        gender: dto.gender,
        userType: dto.userType,
        roomType: dto.roomType,
        roomId: dto.roomId,
        monthlyRent: dto.monthlyRent,
        ...(dto.services?.length && {
          services: { create: dto.services },
        }),
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        userId: await this.findPzeeAccount(dto.phone),
      },
      select: RESIDENT_SELECT,
    });

    return this.present(resident as ResidentRow);
  }

  async update(
    ownerId: string,
    residentId: string,
    dto: UpdateResidentDto,
  ): Promise<ResidentDetail> {
    const pgId = await this.pgIdOf(ownerId);
    const existing = await this.findInPg(pgId, residentId);

    // Moving an active guest to a different type needs a free bed there.
    if (
      dto.roomType &&
      dto.roomType !== existing.roomType &&
      existing.status === 'ACTIVE'
    ) {
      await this.assertBedAvailable(pgId, dto.roomType);
    }

    if (dto.roomId && existing.status === 'ACTIVE') {
      await this.assertRoomHasBed(pgId, dto.roomId, residentId);
    }

    const resident = await this.databaseService.resident.update({
      where: { id: residentId },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        address: dto.address,
        gender: dto.gender,
        userType: dto.userType,
        roomType: dto.roomType,
        ...(dto.roomId !== undefined && { roomId: dto.roomId }),
        monthlyRent: dto.monthlyRent,
        // The whole set is replaced, so removing a service is expressible.
        ...(dto.services && {
          services: { deleteMany: {}, create: dto.services },
        }),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        // A corrected phone number may now match a Pzee account.
        ...(dto.phone && { userId: await this.findPzeeAccount(dto.phone) }),
      },
      select: RESIDENT_SELECT,
    });

    return this.present(resident as ResidentRow);
  }

  /** Marks a guest as moved out, which returns their bed to the pool. */
  async checkout(ownerId: string, residentId: string): Promise<ResidentDetail> {
    const pgId = await this.pgIdOf(ownerId);
    const existing = await this.findInPg(pgId, residentId);

    if (existing.status === 'LEFT') {
      throw new BadRequestException('This guest has already checked out.');
    }

    const resident = await this.databaseService.resident.update({
      where: { id: residentId },
      data: { status: 'LEFT', leftAt: new Date() },
      select: RESIDENT_SELECT,
    });

    return this.present(resident as ResidentRow);
  }

  async remove(ownerId: string, residentId: string): Promise<void> {
    const pgId = await this.pgIdOf(ownerId);
    await this.findInPg(pgId, residentId);

    // Payments cascade with the guest, so a mistaken entry leaves nothing behind.
    await this.databaseService.resident.delete({ where: { id: residentId } });
  }

  async addPayment(
    ownerId: string,
    residentId: string,
    dto: CreatePaymentDto,
  ): Promise<ResidentDetail> {
    const pgId = await this.pgIdOf(ownerId);
    await this.findInPg(pgId, residentId);

    const paidOn = dto.paidOn ? new Date(dto.paidOn) : new Date();

    if (paidOn.getTime() > Date.now()) {
      throw new BadRequestException('A payment cannot be dated in the future.');
    }

    await this.databaseService.payment.create({
      data: {
        residentId,
        pgId,
        amount: dto.amount,
        paidOn,
        forMonth: dto.forMonth ? new Date(dto.forMonth) : undefined,
        note: dto.note,
      },
      select: { id: true },
    });

    const resident = await this.databaseService.resident.findUniqueOrThrow({
      where: { id: residentId },
      select: RESIDENT_SELECT,
    });

    return this.present(resident as ResidentRow);
  }

  async summary(
    ownerId: string,
    query: CrmSummaryQuery,
  ): Promise<CrmSummary> {
    const pgId = await this.pgIdOf(ownerId);
    const now = new Date();
    const from = query.from ? new Date(query.from) : startOfMonth(now);
    const to = query.to
      ? new Date(new Date(query.to).setHours(23, 59, 59, 999))
      : endOfMonth(now);

    if (from > to) {
      throw new BadRequestException('The start date must be before the end date.');
    }

    const [active, collected, roomTypes] = await Promise.all([
      this.databaseService.resident.findMany({
        where: { pgId, status: 'ACTIVE' },
        select: RESIDENT_SELECT,
      }),
      this.databaseService.payment.aggregate({
        where: { pgId, paidOn: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      // Beds come from the actual rooms, not the room-type config.
      this.databaseService.room.groupBy({
        by: ['type'],
        where: { pgId },
        _sum: { totalBeds: true },
        orderBy: { type: 'asc' },
      }),
    ]);

    const presented = active.map((row) => this.present(row as ResidentRow));

    const occupancy: RoomTypeOccupancy[] = roomTypes.map((room) => {
      const totalBeds = room._sum.totalBeds ?? 0;
      const occupiedBeds = presented.filter(
        (resident) => resident.roomType === room.type,
      ).length;

      return {
        type: room.type,
        totalBeds,
        occupiedBeds,
        availableBeds: Math.max(0, totalBeds - occupiedBeds),
      };
    });

    return {
      totalGuests: presented.length,
      pendingAmount: presented.reduce(
        (running, resident) => running + resident.pendingAmount,
        0,
      ),
      collected: collected._sum.amount ?? 0,
      from: from.toISOString(),
      to: to.toISOString(),
      totalBeds: occupancy.reduce((running, r) => running + r.totalBeds, 0),
      availableBeds: occupancy.reduce(
        (running, r) => running + r.availableBeds,
        0,
      ),
      occupancy,
    };
  }

  /** Resolves the PG from the session, never from a client-supplied id. */
  private async pgIdOf(ownerId: string): Promise<string> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: { id: true },
    });

    if (!pg) {
      throw new NotFoundException(
        'No PG is linked to this account yet. Register a PG to manage guests.',
      );
    }

    return pg.id;
  }

  /**
   * Scoped to the caller's PG, so a resident id belonging to someone else reads
   * as missing rather than being exposed or edited.
   */
  private async findInPg(
    pgId: string,
    residentId: string,
  ): Promise<{ roomType: RoomType; status: ResidentDetail['status'] }> {
    const resident = await this.databaseService.resident.findFirst({
      where: { id: residentId, pgId },
      select: { roomType: true, status: true },
    });

    if (!resident) {
      throw new NotFoundException('Guest not found.');
    }

    return resident;
  }

  /** Beds now come from the actual rooms, so capacity is summed across them. */
  private async assertBedAvailable(
    pgId: string,
    roomType: RoomType,
  ): Promise<void> {
    const capacity = await this.databaseService.room.aggregate({
      where: { pgId, type: roomType },
      _sum: { totalBeds: true },
    });

    const totalBeds = capacity._sum.totalBeds ?? 0;

    if (totalBeds === 0) {
      throw new BadRequestException(
        `This PG has no ${this.describe(roomType)} rooms yet. Add rooms first.`,
      );
    }

    const occupied = await this.databaseService.resident.count({
      where: { pgId, roomType, status: 'ACTIVE' },
    });

    if (occupied >= totalBeds) {
      throw new BadRequestException(
        `${this.describe(roomType)} is full: all ${totalBeds} bed${totalBeds === 1 ? '' : 's'} are taken.`,
      );
    }
  }

  /**
   * A specific room can only take as many guests as it has beds, which is what
   * makes "which room is this guest in" trustworthy.
   */
  private async assertRoomHasBed(
    pgId: string,
    roomId: string,
    excludeResidentId?: string,
  ): Promise<void> {
    const room = await this.databaseService.room.findFirst({
      where: { id: roomId, pgId },
      select: { number: true, totalBeds: true },
    });

    if (!room) {
      throw new BadRequestException('That room is not part of this PG.');
    }

    const occupied = await this.databaseService.resident.count({
      where: {
        pgId,
        roomId,
        status: 'ACTIVE',
        ...(excludeResidentId && { NOT: { id: excludeResidentId } }),
      },
    });

    if (occupied >= room.totalBeds) {
      throw new BadRequestException(
        `Room ${room.number} is full: all ${room.totalBeds} bed${room.totalBeds === 1 ? '' : 's'} are taken.`,
      );
    }
  }

  /** Links the guest to their Pzee account when the phone matches one. */
  private async findPzeeAccount(phone: string): Promise<string | null> {
    const user = await this.databaseService.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  private describe(type: RoomType): string {
    return `${type.charAt(0)}${type.slice(1).toLowerCase()} sharing`;
  }

  private present(resident: ResidentRow): ResidentDetail {
    const totalPaid = resident.payments.reduce(
      (running, payment) => running + payment.amount,
      0,
    );

    // Rent is owed for every month elapsed since moving in, up to the day they
    // left. Arrears therefore accumulate rather than showing a single cycle.
    const servicesTotal = resident.services.reduce(
      (running, service) => running + service.monthlyAmount,
      0,
    );
    const monthlyTotal = resident.monthlyRent + servicesTotal;

    const until = resident.leftAt ?? new Date();
    const owed = monthsElapsed(resident.joinedAt, until) * monthlyTotal;

    return {
      id: resident.id,
      fullName: resident.fullName,
      phone: resident.phone,
      address: resident.address,
      gender: resident.gender,
      userType: resident.userType,
      roomType: resident.roomType,
      roomId: resident.roomId,
      roomNumber: resident.room ? resident.room.number : null,
      monthlyRent: resident.monthlyRent,
      servicesTotal,
      monthlyTotal,
      services: resident.services,
      joinedAt: resident.joinedAt.toISOString(),
      dueDate: resident.dueDate ? resident.dueDate.toISOString() : null,
      leftAt: resident.leftAt ? resident.leftAt.toISOString() : null,
      status: resident.status,
      userId: resident.userId,
      hasAccount: resident.userId !== null,
      totalPaid,
      pendingAmount: Math.max(0, owed - totalPaid),
      lastPaymentDate: resident.payments[0]
        ? resident.payments[0].paidOn.toISOString()
        : null,
      payments: resident.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paidOn: payment.paidOn.toISOString(),
        forMonth: payment.forMonth ? payment.forMonth.toISOString() : null,
        note: payment.note,
      })),
    };
  }
}
