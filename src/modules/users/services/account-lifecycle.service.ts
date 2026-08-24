/** Closing, restoring and eventually purging an account. */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRole } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { StorageService } from '../../uploads/services/storage.service';
import { ClosedAccount } from '../models/close-account-response.model';

/**
 * How long a closed account can still be restored. After this the row is
 * removed for real, and the cascade takes its visit requests with it — which is
 * exactly why the delay exists rather than deleting on the spot.
 */
export const ACCOUNT_GRACE_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const ACCOUNT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  isBlocked: true,
  deletedAt: true,
  profileImage: true,
} as const;

@Injectable()
export class AccountLifecycleService {
  private readonly logger = new Logger(AccountLifecycleService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Closes an account: it stops working immediately, and the row survives for
   * the grace period.
   *
   * Nothing else has to change for the lock-out to take effect — `AuthService`
   * refuses to log an inactive account in, and `JwtAuthGuard` rejects the
   * session it already had.
   */
  async close(userId: string): Promise<ClosedAccount> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    if (user.deletedAt) {
      throw new ConflictException('This account is already closed.');
    }

    this.assertDeletable(user.role);

    const closed = await this.databaseService.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive: false, deletedAt: new Date() },
        select: ACCOUNT_SELECT,
      });

      // A closed owner cannot answer an enquiry, so their listing comes off the
      // site at once rather than lingering for the whole grace period. The row
      // itself survives until the purge, and `publishedAt` is deliberately left
      // set — it is what tells `restore` the listing was live before.
      if (updated.role === UserRole.PG_OWNER) {
        await tx.pg.updateMany({
          where: { ownerId: userId, isPublished: true },
          data: { isPublished: false },
        });
      }

      return updated;
    });

    this.logger.log(`Account closed: ${closed.email}`);

    return this.present(closed);
  }

  /** Undoes a close, while the row is still here to undo it with. */
  async restore(userId: string): Promise<ClosedAccount> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    if (!user.deletedAt) {
      throw new ConflictException('This account is not closed.');
    }

    const restored = await this.databaseService.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive: true, deletedAt: null },
        select: ACCOUNT_SELECT,
      });

      // Put the listing back exactly as it was. `publishedAt` set while
      // `isPublished` is false means it was live and closing hid it — a PG that
      // never published has no `publishedAt`, so it correctly stays private and
      // its owner still has to pay the fee.
      if (updated.role === UserRole.PG_OWNER) {
        await tx.pg.updateMany({
          where: { ownerId: userId, isPublished: false, publishedAt: { not: null } },
          data: { isPublished: true },
        });
      }

      return updated;
    });

    this.logger.log(`Account restored: ${restored.email}`);

    return this.present(restored);
  }

  /**
   * Removes accounts whose grace period has run out.
   *
   * Runs at 3am rather than on a timer from boot, so a service that redeploys
   * several times a day does not re-run it several times a day.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - ACCOUNT_GRACE_DAYS * MILLISECONDS_PER_DAY);

    const expired = await this.databaseService.user.findMany({
      where: { deletedAt: { not: null, lt: cutoff } },
      select: { id: true, email: true, profileImage: true },
    });

    if (expired.length === 0) return 0;

    const { count } = await this.databaseService.user.deleteMany({
      where: { id: { in: expired.map((user) => user.id) } },
    });

    // The rows are gone; their uploaded photos would otherwise stay forever.
    void this.storageService.deleteImages(
      expired
        .map((user) => user.profileImage)
        .filter((url): url is string => Boolean(url)),
    );

    this.logger.log(
      `Purged ${count} account(s) closed before ${cutoff.toISOString()}`,
    );

    return count;
  }

  /**
   * Blocks an account, or lets it back in.
   *
   * Separate from closing: a block is a door held shut, reversible in a click
   * and with no countdown behind it. `AuthService` already refuses to log a
   * blocked account in and `JwtAuthGuard` already rejects the session it had,
   * so this takes effect on the very next request.
   */
  async setBlocked(userId: string, blocked: boolean): Promise<ClosedAccount> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException('A Super Admin account cannot be blocked.');
    }

    if (user.isBlocked === blocked) {
      throw new ConflictException(
        blocked
          ? 'This account is already blocked.'
          : 'This account is not blocked.',
      );
    }

    const updated = await this.databaseService.user.update({
      where: { id: userId },
      data: { isBlocked: blocked },
      select: ACCOUNT_SELECT,
    });

    this.logger.log(
      `Account ${blocked ? 'blocked' : 'unblocked'}: ${updated.email}`,
    );

    return this.present(updated);
  }

  /**
   * Only a Super Admin is refused, and that is about the platform locking
   * itself out rather than about the data.
   *
   * A PG owner *is* deletable, deliberately. `Pg.ownerId` cascades, so the
   * purge at the end of the grace period takes the PG with the owner — and
   * with it the rooms, residents, services and every payment recorded against
   * them. Closing hides the listing at once; the thirty days before that
   * becomes permanent is the whole safety net, which is why the confirmation
   * has to spell out what goes.
   */
  private assertDeletable(role: UserRole): void {
    if (role === UserRole.SUPER_ADMIN) {
      throw new ConflictException('A Super Admin account cannot be deleted.');
    }
  }

  private present(user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    deletedAt: Date | null;
  }): ClosedAccount {
    const purgeOn = user.deletedAt
      ? new Date(user.deletedAt.getTime() + ACCOUNT_GRACE_DAYS * MILLISECONDS_PER_DAY)
      : null;

    return {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      email: user.email,
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
      purgeOn: purgeOn ? purgeOn.toISOString() : null,
      graceDays: ACCOUNT_GRACE_DAYS,
    };
  }
}
