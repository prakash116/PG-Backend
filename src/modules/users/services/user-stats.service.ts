/** Sign-up numbers behind the admin chart. */
import { Injectable } from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  SignupPoint,
  UserStatsDetail,
} from '../models/user-stats-response.model';
import { UserStatsQuery } from '../models/user-stats-query.dto';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
/** A year of daily points is already more than a chart can show usefully. */
const MAX_RANGE_DAYS = 366;

/**
 * A calendar day as `YYYY-MM-DD`, from the date's own parts.
 *
 * Not `toISOString()`: that converts to UTC first, so an account created at
 * 1am in Delhi would be filed under the previous day.
 */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

@Injectable()
export class UserStatsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async signups(query: UserStatsQuery): Promise<UserStatsDetail> {
    const to = query.to ? endOfDay(query.to) : endOfDay(dayKey(new Date()));
    const from = query.from
      ? startOfDay(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * MILLISECONDS_PER_DAY);

    // A backwards or absurd range is treated as the default rather than
    // refused: this drives a chart, and an empty chart explains nothing.
    const spanDays = Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
    const start =
      spanDays < 0 || spanDays > MAX_RANGE_DAYS
        ? new Date(to.getTime() - DEFAULT_RANGE_DAYS * MILLISECONDS_PER_DAY)
        : from;

    const [inRange, totals, beforeRange] = await Promise.all([
      this.databaseService.user.findMany({
        where: { createdAt: { gte: start, lte: to } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, role: true },
      }),
      this.databaseService.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      // Everyone who was already here, so the running total starts where the
      // platform actually stood rather than at zero.
      this.databaseService.user.count({ where: { createdAt: { lt: start } } }),
    ]);

    const byDay = new Map<string, { customers: number; owners: number }>();

    for (const user of inRange) {
      const key = dayKey(user.createdAt);
      const entry = byDay.get(key) ?? { customers: 0, owners: 0 };

      if (user.role === UserRole.PG_OWNER) entry.owners += 1;
      else if (user.role === UserRole.USER) entry.customers += 1;

      byDay.set(key, entry);
    }

    const series: SignupPoint[] = [];
    let running = beforeRange;

    // Every day in the range, including the ones nobody joined — gaps in a
    // time series read as missing data rather than as a quiet day.
    for (
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      cursor <= to;
      cursor = new Date(cursor.getTime() + MILLISECONDS_PER_DAY)
    ) {
      const key = dayKey(cursor);
      const day = byDay.get(key) ?? { customers: 0, owners: 0 };

      running += day.customers + day.owners;
      series.push({ date: key, ...day, total: running });
    }

    const countOf = (role: UserRole) =>
      totals.find((row) => row.role === role)?._count._all ?? 0;

    return {
      from: dayKey(start),
      to: dayKey(to),
      totalAccounts: totals.reduce((sum, row) => sum + row._count._all, 0),
      totalCustomers: countOf(UserRole.USER),
      totalOwners: countOf(UserRole.PG_OWNER),
      joinedInRange: inRange.length,
      series,
    };
  }
}
