import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

export interface PaymentRow {
  id: string;
  amount: number;
  paidOn: string;
  forMonth: string | null;
  note: string | null;
  residentId: string;
  residentName: string;
  roomNumber: string | null;
}

export interface MonthlyEarning {
  /** The month as YYYY-MM, so it cannot shift across a timezone. */
  month: string;
  collected: number;
}

export interface PaymentsSummary {
  /** Every payment ever recorded for this PG. */
  totalEarnings: number;
  /** Collected inside the requested period. */
  collected: number;
  /** Owed right now across active guests. */
  dueAmount: number;
  /** Guests with something outstanding. */
  guestsInArrears: number;
  /** What every active guest is billed each month, rent plus services. */
  expectedMonthly: number;
  from: string;
  to: string;
  monthly: MonthlyEarning[];
  recent: PaymentRow[];
}

const MONTHS_CHARTED = 6;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Whole months from `start` to `end`, counting the first as due on arrival. */
function monthsElapsed(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 1 : 0);

  return Math.max(1, months);
}

@Injectable()
export class PaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(
    ownerId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentsSummary> {
    const pgId = await this.pgIdOf(ownerId);
    const now = new Date();
    const from = range.from ? new Date(range.from) : startOfMonth(now);
    const to = range.to
      ? new Date(new Date(range.to).setHours(23, 59, 59, 999))
      : endOfMonth(now);

    if (from > to) {
      throw new BadRequestException(
        'The start date must be before the end date.',
      );
    }

    const chartFrom = startOfMonth(
      new Date(now.getFullYear(), now.getMonth() - (MONTHS_CHARTED - 1), 1),
    );

    const [allTime, inPeriod, active, chartable, recent] = await Promise.all([
      this.databaseService.payment.aggregate({
        where: { pgId },
        _sum: { amount: true },
      }),
      this.databaseService.payment.aggregate({
        where: { pgId, paidOn: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.databaseService.resident.findMany({
        where: { pgId, status: 'ACTIVE' },
        select: {
          monthlyRent: true,
          joinedAt: true,
          services: { select: { monthlyAmount: true } },
          payments: { select: { amount: true } },
        },
      }),
      this.databaseService.payment.findMany({
        where: { pgId, paidOn: { gte: chartFrom } },
        select: { amount: true, paidOn: true },
      }),
      this.databaseService.payment.findMany({
        where: { pgId },
        select: {
          id: true,
          amount: true,
          paidOn: true,
          forMonth: true,
          note: true,
          resident: {
            select: {
              id: true,
              fullName: true,
              room: { select: { number: true } },
            },
          },
        },
        orderBy: { paidOn: 'desc' },
        take: 20,
      }),
    ]);

    let dueAmount = 0;
    let guestsInArrears = 0;
    let expectedMonthly = 0;

    for (const resident of active) {
      const monthlyTotal =
        resident.monthlyRent +
        resident.services.reduce(
          (running, service) => running + service.monthlyAmount,
          0,
        );

      const owed = monthsElapsed(resident.joinedAt, now) * monthlyTotal;
      const paid = resident.payments.reduce(
        (running, payment) => running + payment.amount,
        0,
      );
      const pending = Math.max(0, owed - paid);

      expectedMonthly += monthlyTotal;
      dueAmount += pending;
      if (pending > 0) guestsInArrears += 1;
    }

    return {
      totalEarnings: allTime._sum.amount ?? 0,
      collected: inPeriod._sum.amount ?? 0,
      dueAmount,
      guestsInArrears,
      expectedMonthly,
      from: from.toISOString(),
      to: to.toISOString(),
      monthly: this.chart(chartable, now),
      recent: recent.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paidOn: payment.paidOn.toISOString(),
        forMonth: payment.forMonth ? payment.forMonth.toISOString() : null,
        note: payment.note,
        residentId: payment.resident.id,
        residentName: payment.resident.fullName,
        roomNumber: payment.resident.room?.number ?? null,
      })),
    };
  }

  /**
   * The last six months, including ones with nothing collected. Months are
   * keyed as YYYY-MM rather than as an ISO instant: calling toISOString() on a
   * local midnight shifts the date back in any timezone ahead of UTC, which
   * labelled August as July here in IST.
   */
  private chart(
    payments: Array<{ amount: number; paidOn: Date }>,
    now: Date,
  ): MonthlyEarning[] {
    const key = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const buckets = new Map<string, number>();

    for (let back = MONTHS_CHARTED - 1; back >= 0; back -= 1) {
      buckets.set(key(new Date(now.getFullYear(), now.getMonth() - back, 1)), 0);
    }

    for (const payment of payments) {
      const month = key(payment.paidOn);

      if (buckets.has(month)) {
        buckets.set(month, (buckets.get(month) ?? 0) + payment.amount);
      }
    }

    return [...buckets].map(([month, collected]) => ({ month, collected }));
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
