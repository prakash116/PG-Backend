/** Every PG on the platform, as a Super Admin sees it. */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PlatformPaymentStatus,
  ResidentStatus,
  RoomType,
  VerificationStatus,
} from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  AdminPgDetail,
  AdminPgSummary,
  RevenuePoint,
} from '../models/admin-pg-response.model';
import { AdminUpdatePgDto } from '../models/admin-pg.dto';

/** How far back the revenue chart looks. */
const REVENUE_MONTHS = 12;

const SUMMARY_SELECT = {
  pgCode: true,
  name: true,
  location: true,
  city: true,
  logo: true,
  gender: true,
  verification: true,
  isPublished: true,
  createdAt: true,
  owner: { select: { firstName: true, lastName: true, phone: true } },
  listingFee: { select: { status: true, paidAt: true } },
  rooms: { select: { totalBeds: true } },
  residents: {
    where: { status: ResidentStatus.ACTIVE },
    select: { id: true },
  },
  payments: { select: { amount: true } },
} as const;

type SummaryRow = {
  pgCode: string;
  name: string;
  location: string;
  city: string | null;
  logo: string | null;
  gender: AdminPgSummary['gender'];
  verification: VerificationStatus;
  isPublished: boolean;
  createdAt: Date;
  owner: { firstName: string; lastName: string | null; phone: string };
  listingFee: { status: PlatformPaymentStatus; paidAt: Date | null } | null;
  rooms: Array<{ totalBeds: number }>;
  residents: Array<{ id: string }>;
  payments: Array<{ amount: number }>;
};

/** `YYYY-MM` from the date's own parts, never through UTC. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function summaryOf(pg: SummaryRow): AdminPgSummary {
  return {
    pgCode: pg.pgCode,
    name: pg.name,
    address: pg.location,
    city: pg.city,
    ownerName: [pg.owner.firstName, pg.owner.lastName].filter(Boolean).join(' '),
    ownerPhone: pg.owner.phone,
    logo: pg.logo,
    gender: pg.gender,
    verification: pg.verification,
    isPublished: pg.isPublished,
    // Membership is the one-off listing fee: null means it was never raised.
    membership: pg.listingFee?.status ?? null,
    membershipPaidAt: pg.listingFee?.paidAt
      ? pg.listingFee.paidAt.toISOString()
      : null,
    rooms: pg.rooms.length,
    beds: pg.rooms.reduce((total, room) => total + room.totalBeds, 0),
    residents: pg.residents.length,
    revenue: pg.payments.reduce((total, payment) => total + payment.amount, 0),
    registeredAt: pg.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminPgService {
  private readonly logger = new Logger(AdminPgService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Every PG, newest first. */
  async list(): Promise<AdminPgSummary[]> {
    const pgs = await this.databaseService.pg.findMany({
      orderBy: { createdAt: 'desc' },
      select: SUMMARY_SELECT,
    });

    return pgs.map(summaryOf);
  }

  /** One PG with its rooms, its guests and what it has collected. */
  async detail(pgCode: string): Promise<AdminPgDetail> {
    const pg = await this.databaseService.pg.findUnique({
      where: { pgCode },
      select: {
        ...SUMMARY_SELECT,
        id: true,
        description: true,
        amenities: true,
        images: true,
        owner: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        roomTypes: { select: { type: true, pricePerBed: true } },
      },
    });

    if (!pg) {
      throw new NotFoundException(`No PG found with the code ${pgCode}.`);
    }

    const [rooms, residents, payments] = await Promise.all([
      this.databaseService.room.findMany({
        where: { pgId: pg.id },
        orderBy: { number: 'asc' },
        select: {
          number: true,
          type: true,
          totalBeds: true,
          residents: {
            where: { status: ResidentStatus.ACTIVE },
            select: { id: true },
          },
        },
      }),
      this.databaseService.resident.findMany({
        where: { pgId: pg.id },
        orderBy: [{ status: 'asc' }, { joinedAt: 'desc' }],
        select: {
          fullName: true,
          phone: true,
          roomType: true,
          monthlyRent: true,
          status: true,
          joinedAt: true,
          dueDate: true,
          room: { select: { number: true } },
        },
      }),
      this.databaseService.payment.findMany({
        where: { pgId: pg.id },
        orderBy: { paidOn: 'asc' },
        select: { amount: true, paidOn: true },
      }),
    ]);

    const roomList = rooms.map((room) => ({
      number: room.number,
      type: room.type,
      totalBeds: room.totalBeds,
      occupiedBeds: room.residents.length,
    }));

    const roomsByType = new Map<RoomType, number>();
    for (const room of rooms) {
      roomsByType.set(room.type, (roomsByType.get(room.type) ?? 0) + 1);
    }

    const beds = roomList.reduce((total, room) => total + room.totalBeds, 0);
    const occupied = roomList.reduce(
      (total, room) => total + room.occupiedBeds,
      0,
    );

    return {
      // `pg.residents` already came back filtered to ACTIVE by SUMMARY_SELECT,
      // which is exactly the count the summary wants.
      ...summaryOf(pg),
      description: pg.description,
      amenities: pg.amenities,
      images: pg.images,
      ownerEmail: pg.owner.email,
      availableBeds: Math.max(0, beds - occupied),
      roomTypes: pg.roomTypes.map((type) => ({
        type: type.type,
        pricePerBed: type.pricePerBed,
        rooms: roomsByType.get(type.type) ?? 0,
      })),
      roomList,
      residentList: residents.map((resident) => ({
        fullName: resident.fullName,
        phone: resident.phone,
        roomNumber: resident.room?.number ?? null,
        roomType: resident.roomType,
        monthlyRent: resident.monthlyRent,
        status: resident.status,
        joinedAt: resident.joinedAt.toISOString(),
        dueDate: resident.dueDate ? resident.dueDate.toISOString() : null,
      })),
      revenueByMonth: monthlyRevenue(payments),
    };
  }

  /** Verify a listing, or take it off the site. */
  async update(
    pgCode: string,
    dto: AdminUpdatePgDto,
  ): Promise<AdminPgSummary> {
    await this.assertExists(pgCode);

    const pg = await this.databaseService.pg.update({
      where: { pgCode },
      data: {
        ...(dto.verification !== undefined && {
          verification: dto.verification,
          // Kept alongside the status so the badge can say when.
          verifiedAt:
            dto.verification === VerificationStatus.VERIFIED
              ? new Date()
              : null,
        }),
        ...(dto.isPublished !== undefined && {
          isPublished: dto.isPublished,
          // publishedAt is deliberately not cleared: it is what remembers the
          // listing was live, and the account restore path relies on it.
          ...(dto.isPublished && { publishedAt: new Date() }),
        }),
      },
      select: SUMMARY_SELECT,
    });

    this.logger.log(
      `PG ${pgCode} updated: ${JSON.stringify(dto)} by a Super Admin`,
    );

    return summaryOf(pg);
  }

  /**
   * Removes a listing for good.
   *
   * Unlike closing an owner's account there is no grace period here, because
   * the owner survives: they keep their account and can register a PG again.
   * What goes is the listing and everything hanging off it.
   */
  async remove(pgCode: string): Promise<AdminPgSummary> {
    const pg = await this.assertExists(pgCode);

    await this.databaseService.pg.delete({ where: { pgCode } });

    this.logger.log(`PG ${pgCode} deleted by a Super Admin`);

    return pg;
  }

  private async assertExists(pgCode: string): Promise<AdminPgSummary> {
    const pg = await this.databaseService.pg.findUnique({
      where: { pgCode },
      select: SUMMARY_SELECT,
    });

    if (!pg) {
      throw new NotFoundException(`No PG found with the code ${pgCode}.`);
    }

    return summaryOf(pg);
  }
}

/**
 * The last twelve months of collections, including the empty ones — a gap in a
 * time series reads as missing data rather than as a quiet month.
 */
function monthlyRevenue(
  payments: Array<{ amount: number; paidOn: Date }>,
): RevenuePoint[] {
  const totals = new Map<string, number>();

  for (const payment of payments) {
    const key = monthKey(payment.paidOn);
    totals.set(key, (totals.get(key) ?? 0) + payment.amount);
  }

  const now = new Date();
  const series: RevenuePoint[] = [];

  for (let back = REVENUE_MONTHS - 1; back >= 0; back -= 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = monthKey(month);

    series.push({ month: key, amount: totals.get(key) ?? 0 });
  }

  return series;
}
