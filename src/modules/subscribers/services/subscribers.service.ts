/** The newsletter list behind the footer form. */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriberStatus } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { isUniqueConstraintOn } from '../../../database/prisma-errors';
import { SubscriberDetail } from '../models/subscriber-response.model';

const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  status: true,
  subscribedAt: true,
  blockedAt: true,
} as const;

@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Adds an address to the list, from a form anyone can reach.
   *
   * Deliberately quiet about what it found. Subscribing twice is not an error
   * worth showing, and a blocked address is left blocked without saying so —
   * telling an anonymous form which addresses are on the list, or which an
   * admin has blocked, would turn it into a lookup tool.
   */
  async subscribe(email: string): Promise<void> {
    try {
      await this.databaseService.subscriber.create({
        data: { email },
        select: { id: true },
      });

      this.logger.log(`New subscriber: ${email}`);
    } catch (error: unknown) {
      // Already on the list. Nothing to do, and nothing to report.
      if (isUniqueConstraintOn(error, 'email')) return;

      throw error;
    }
  }

  /** Super Admin: the whole list, newest first. */
  async list(): Promise<SubscriberDetail[]> {
    const subscribers = await this.databaseService.subscriber.findMany({
      orderBy: { subscribedAt: 'desc' },
      select: SUBSCRIBER_SELECT,
    });

    return subscribers.map(present);
  }

  /** Super Admin: block an address, or let it start receiving email again. */
  async setStatus(
    id: string,
    status: SubscriberStatus,
  ): Promise<SubscriberDetail> {
    await this.assertExists(id);

    const subscriber = await this.databaseService.subscriber.update({
      where: { id },
      data: {
        status,
        // Kept so the list can say when, and cleared on unblock rather than
        // left behind to confuse the next person reading the row.
        blockedAt: status === SubscriberStatus.BLOCKED ? new Date() : null,
      },
      select: SUBSCRIBER_SELECT,
    });

    return present(subscriber);
  }

  /**
   * Super Admin: remove an address for good.
   *
   * A real delete, not a flag. Someone who wants off a mailing list wants to be
   * gone from it, and blocking already covers the case where the record should
   * be kept.
   */
  async remove(id: string): Promise<SubscriberDetail> {
    const subscriber = await this.assertExists(id);

    await this.databaseService.subscriber.delete({ where: { id } });

    return present(subscriber);
  }

  private async assertExists(id: string) {
    const subscriber = await this.databaseService.subscriber.findUnique({
      where: { id },
      select: SUBSCRIBER_SELECT,
    });

    if (!subscriber) {
      throw new NotFoundException('That subscriber no longer exists.');
    }

    return subscriber;
  }
}

function present(subscriber: {
  id: string;
  email: string;
  status: SubscriberStatus;
  subscribedAt: Date;
  blockedAt: Date | null;
}): SubscriberDetail {
  return {
    ...subscriber,
    subscribedAt: subscriber.subscribedAt.toISOString(),
    blockedAt: subscriber.blockedAt ? subscriber.blockedAt.toISOString() : null,
  };
}
