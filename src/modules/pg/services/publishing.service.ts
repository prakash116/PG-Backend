/** Taking a PG listing public: the ₹100 listing fee and the referral reward. */
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformPaymentStatus } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  ListingFeeDetail,
  PendingFeeItem,
  PublishStatusDetail,
} from '../models/publishing-response.model';

const FEE_SELECT = {
  id: true,
  amount: true,
  status: true,
  reference: true,
  paidAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get fee(): number {
    return this.configService.getOrThrow<number>('app.listing.feeRupees');
  }

  private get reward(): number {
    return this.configService.getOrThrow<number>(
      'app.listing.referralRewardRupees',
    );
  }

  private get payeeUpiId(): string {
    return this.configService.getOrThrow<string>('app.listing.payeeUpiId');
  }

  /** Where a PG stands: private, waiting on the fee, or live. */
  async statusForOwner(ownerId: string): Promise<PublishStatusDetail> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: {
        id: true,
        isPublished: true,
        publishedAt: true,
        listingFee: { select: FEE_SELECT },
        referredBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!pg) {
      throw new NotFoundException('No PG is registered to this account.');
    }

    return {
      isPublished: pg.isPublished,
      publishedAt: pg.publishedAt ? pg.publishedAt.toISOString() : null,
      feeRupees: this.fee,
      payeeUpiId: this.payeeUpiId,
      referredBy: pg.referredBy
        ? [pg.referredBy.firstName, pg.referredBy.lastName]
            .filter(Boolean)
            .join(' ')
        : null,
      fee: pg.listingFee ? toFeeDetail(pg.listingFee) : null,
    };
  }

  /**
   * The owner asking to publish. This does not publish anything: it records
   * that the fee is owed and hands back where to send it. A Super Admin
   * confirming receipt is what makes the listing public.
   *
   * Safe to call twice — a second press returns the same pending fee rather
   * than creating another, which is what the unique key on `pgId` guarantees.
   */
  async requestPublish(ownerId: string): Promise<PublishStatusDetail> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: { id: true, isPublished: true, listingFee: { select: FEE_SELECT } },
    });

    if (!pg) {
      throw new NotFoundException('No PG is registered to this account.');
    }

    if (pg.isPublished) {
      throw new ConflictException('This PG is already published.');
    }

    if (!pg.listingFee) {
      await this.databaseService.platformPayment.create({
        data: { pgId: pg.id, amount: this.fee },
        select: { id: true },
      });
    }

    return this.statusForOwner(ownerId);
  }

  /** Every fee still waiting on a Super Admin to confirm it. */
  async pendingFees(): Promise<PendingFeeItem[]> {
    const fees = await this.databaseService.platformPayment.findMany({
      where: { status: PlatformPaymentStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        pg: {
          select: {
            pgCode: true,
            name: true,
            location: true,
            owner: { select: { firstName: true, lastName: true, phone: true } },
            referredBy: {
              select: { firstName: true, lastName: true, referralCode: true },
            },
          },
        },
      },
    });

    return fees.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      requestedAt: entry.createdAt.toISOString(),
      pgCode: entry.pg.pgCode,
      pgName: entry.pg.name,
      pgLocation: entry.pg.location,
      ownerName: [entry.pg.owner.firstName, entry.pg.owner.lastName]
        .filter(Boolean)
        .join(' '),
      ownerPhone: entry.pg.owner.phone,
      referredByName: entry.pg.referredBy
        ? [entry.pg.referredBy.firstName, entry.pg.referredBy.lastName]
            .filter(Boolean)
            .join(' ')
        : null,
      referralCode: entry.pg.referredBy?.referralCode ?? null,
      rewardRupees: entry.pg.referredBy ? this.reward : 0,
    }));
  }

  /**
   * A Super Admin confirming the fee arrived. This is the one place a listing
   * goes public and the one place a referral reward is created, so the two can
   * never disagree — both happen in a single transaction or neither does.
   *
   * When Razorpay is connected, its webhook calls exactly this.
   */
  async confirmFee(
    pgCode: string,
    adminId: string,
    reference: string | undefined,
  ): Promise<PublishStatusDetail> {
    const pg = await this.databaseService.pg.findUnique({
      where: { pgCode },
      select: {
        id: true,
        ownerId: true,
        isPublished: true,
        referredById: true,
        listingFee: { select: { id: true, status: true } },
      },
    });

    if (!pg) {
      throw new NotFoundException(`No PG found with the code ${pgCode}.`);
    }

    if (!pg.listingFee) {
      throw new ConflictException(
        'This PG has not asked to be published, so there is no fee to confirm.',
      );
    }

    if (pg.listingFee.status === PlatformPaymentStatus.PAID) {
      throw new ConflictException('This fee has already been confirmed.');
    }

    const paidAt = new Date();

    await this.databaseService.$transaction(async (tx) => {
      await tx.platformPayment.update({
        where: { id: pg.listingFee!.id },
        data: {
          status: PlatformPaymentStatus.PAID,
          paidAt,
          reference: reference?.trim() || null,
          confirmedById: adminId,
        },
      });

      await tx.pg.update({
        where: { id: pg.id },
        data: { isPublished: true, publishedAt: paidAt },
      });

      // No referrer means nobody to credit, which is the ordinary case for a PG
      // that found us on its own.
      if (pg.referredById) {
        await tx.referralReward.create({
          data: {
            customerId: pg.referredById,
            pgId: pg.id,
            amount: this.reward,
          },
        });
      }
    });

    this.logger.log(
      `Listing fee confirmed for ${pgCode}${
        pg.referredById ? `, ₹${this.reward} credited to the referrer` : ''
      }`,
    );

    return this.statusOf(pg.ownerId);
  }

  /** The owner-facing view, addressed by owner id. */
  private statusOf(ownerId: string): Promise<PublishStatusDetail> {
    return this.statusForOwner(ownerId);
  }
}

function toFeeDetail(fee: {
  id: string;
  amount: number;
  status: PlatformPaymentStatus;
  reference: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): ListingFeeDetail {
  return {
    id: fee.id,
    amount: fee.amount,
    status: fee.status,
    reference: fee.reference,
    paidAt: fee.paidAt ? fee.paidAt.toISOString() : null,
    requestedAt: fee.createdAt.toISOString(),
  };
}
