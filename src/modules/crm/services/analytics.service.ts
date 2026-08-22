import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';

export interface MonthlyPoint {
  /** YYYY-MM, kept as a plain month so no timezone can shift it. */
  month: string;
  /** Beds taken as at the end of that month. */
  occupiedBeds: number;
  occupancyRate: number;
  collected: number;
  joined: number;
  left: number;
  visits: number;
}

export interface RoomTypePerformance {
  type: RoomType;
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  /** Rent plus services from the guests in this type, per month. */
  monthlyRevenue: number;
}

export interface AnalyticsSummary {
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  /** Guests staying now, and how many have moved on. */
  activeGuests: number;
  pastGuests: number;
  /** Average months a departed guest stayed. Null until someone has left. */
  averageStayMonths: number | null;
  visitsTotal: number;
  visitsCompleted: number;
  /** Completed visits as a share of all requests. */
  visitConversion: number;
  monthly: MonthlyPoint[];
  byRoomType: RoomTypePerformance[];
  /** Historical occupancy is measured against today's bed count. */
  occupancyCaveat: string;
}

const MONTHS_CHARTED = 6;

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return Math.max(1, months);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(ownerId: string): Promise<AnalyticsSummary> {
    const pgId = await this.pgIdOf(ownerId);
    const now = new Date();

    const window = new Date(
      now.getFullYear(),
      now.getMonth() - (MONTHS_CHARTED - 1),
      1,
    );

    const [residents, rooms, payments, visits] = await Promise.all([
      this.databaseService.resident.findMany({
        where: { pgId },
        select: {
          roomType: true,
          monthlyRent: true,
          joinedAt: true,
          leftAt: true,
          status: true,
          services: { select: { monthlyAmount: true } },
        },
      }),
      this.databaseService.room.groupBy({
        by: ['type'],
        where: { pgId },
        _sum: { totalBeds: true },
      }),
      this.databaseService.payment.findMany({
        where: { pgId, paidOn: { gte: window } },
        select: { amount: true, paidOn: true },
      }),
      this.databaseService.visitRequest.findMany({
        where: { pgId },
        select: { createdAt: true, status: true },
      }),
    ]);

    const bedsByType = new Map<RoomType, number>(
      rooms.map((room) => [room.type, room._sum.totalBeds ?? 0]),
    );
    const totalBeds = [...bedsByType.values()].reduce(
      (running, beds) => running + beds,
      0,
    );

    const active = residents.filter(
      (resident) => resident.status === 'ACTIVE',
    );
    const departed = residents.filter((resident) => resident.leftAt !== null);

    const monthly: MonthlyPoint[] = [];

    for (let back = MONTHS_CHARTED - 1; back >= 0; back -= 1) {
      const monthIndex = now.getMonth() - back;
      const start = new Date(now.getFullYear(), monthIndex, 1);
      const end = endOfMonth(now.getFullYear(), monthIndex);
      const key = monthKey(start);

      // A snapshot as at month end: anyone who had moved in and had not yet
      // moved out. Reads the same way an occupancy report normally does.
      const asAt = end > now ? now : end;
      const occupiedBeds = residents.filter(
        (resident) =>
          resident.joinedAt <= asAt &&
          (resident.leftAt === null || resident.leftAt > asAt),
      ).length;

      monthly.push({
        month: key,
        occupiedBeds,
        occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        collected: payments
          .filter((payment) => monthKey(payment.paidOn) === key)
          .reduce((running, payment) => running + payment.amount, 0),
        joined: residents.filter(
          (resident) => monthKey(resident.joinedAt) === key,
        ).length,
        left: residents.filter(
          (resident) => resident.leftAt !== null && monthKey(resident.leftAt) === key,
        ).length,
        visits: visits.filter((visit) => monthKey(visit.createdAt) === key)
          .length,
      });

      void start;
    }

    const byRoomType: RoomTypePerformance[] = [...bedsByType.entries()]
      .map(([type, beds]) => {
        const inType = active.filter((resident) => resident.roomType === type);

        return {
          type,
          totalBeds: beds,
          occupiedBeds: inType.length,
          occupancyRate: beds > 0 ? Math.round((inType.length / beds) * 100) : 0,
          monthlyRevenue: inType.reduce(
            (running, resident) =>
              running +
              resident.monthlyRent +
              resident.services.reduce(
                (sum, service) => sum + service.monthlyAmount,
                0,
              ),
            0,
          ),
        };
      })
      .sort((a, b) => a.type.localeCompare(b.type));

    const completedVisits = visits.filter(
      (visit) => visit.status === 'COMPLETED',
    ).length;

    return {
      totalBeds,
      occupiedBeds: active.length,
      occupancyRate:
        totalBeds > 0 ? Math.round((active.length / totalBeds) * 100) : 0,
      activeGuests: active.length,
      pastGuests: departed.length,
      averageStayMonths:
        departed.length > 0
          ? Math.round(
              (departed.reduce(
                (running, resident) =>
                  running +
                  monthsBetween(resident.joinedAt, resident.leftAt as Date),
                0,
              ) /
                departed.length) *
                10,
            ) / 10
          : null,
      visitsTotal: visits.length,
      visitsCompleted: completedVisits,
      visitConversion:
        visits.length > 0
          ? Math.round((completedVisits / visits.length) * 100)
          : 0,
      monthly,
      byRoomType,
      occupancyCaveat:
        'Past months are measured against the beds you have today, because room changes are not kept as history.',
    };
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
}
