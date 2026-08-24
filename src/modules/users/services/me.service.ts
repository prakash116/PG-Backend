/** The account, and the stay, belonging to whoever is signed in. */
import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ResidentStatus,
} from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { isUniqueConstraintOn } from '../../../database/prisma-errors';
import { StorageService } from '../../uploads/services/storage.service';
import { ProfileDetail } from '../models/profile-response.model';
import { ReferralsDetail } from '../models/referrals-response.model';
import { StayDetail } from '../models/stay-response.model';
import { UpdateProfileDto } from '../models/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  userType: true,
  gender: true,
  dateOfBirth: true,
  profileImage: true,
  address: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  createdAt: true,
} as const;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>;

/**
 * A `@db.Date` column comes back as midnight UTC, so taking the first ten
 * characters of the ISO string is the date that was stored. Formatting it
 * through local time is what once labelled an August record as July.
 */
function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

@Injectable()
export class MeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async getProfile(userId: string): Promise<ProfileDetail> {
    // The session guard has already proven this row exists.
    const user = await this.databaseService.user.findUniqueOrThrow({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    return toProfileDetail(user);
  }

  /**
   * These thirteen assignments are the allow-list, and the only reason they are
   * written out one by one.
   *
   * The DTO already omits `role`, `isActive` and `isBlocked`, and the global
   * ValidationPipe strips unknown keys — but a DTO describes a request, while
   * this describes the database. Spreading a request body into Prisma is how a
   * listing once became able to verify itself; here the same shortcut would let
   * an account promote itself to Super Admin.
   *
   * `undefined` means "leave unchanged", which is what PATCH implies.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.userType !== undefined) data.userType = dto.userType;

    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = new Date(dto.dateOfBirth);
    }

    // A blank optional field means "clear it", not the empty string — and
    // plenty of people go by one name only.
    if (dto.lastName !== undefined) data.lastName = blankToNull(dto.lastName);
    if (dto.profileImage !== undefined) {
      data.profileImage = blankToNull(dto.profileImage);
    }
    if (dto.address !== undefined) data.address = blankToNull(dto.address);
    if (dto.city !== undefined) data.city = blankToNull(dto.city);
    if (dto.state !== undefined) data.state = blankToNull(dto.state);
    if (dto.country !== undefined) data.country = blankToNull(dto.country);
    if (dto.pincode !== undefined) data.pincode = blankToNull(dto.pincode);

    // Read before writing, so a replaced photo can be cleaned up afterwards.
    const previousImage =
      data.profileImage === undefined
        ? null
        : (
            await this.databaseService.user.findUniqueOrThrow({
              where: { id: userId },
              select: { profileImage: true },
            })
          ).profileImage;

    try {
      const user = await this.databaseService.user.update({
        where: { id: userId },
        data,
        select: PROFILE_SELECT,
      });

      // A replaced or removed photo would otherwise leave its file behind — the
      // same housekeeping the PG listing already does for its logo.
      if (previousImage && previousImage !== user.profileImage) {
        void this.storageService.deleteImage(previousImage);
      }

      return toProfileDetail(user);
    } catch (error) {
      if (isUniqueConstraintOn(error, 'email')) {
        throw new ConflictException('That email is already in use.');
      }

      if (isUniqueConstraintOn(error, 'phone')) {
        throw new ConflictException('That phone number is already in use.');
      }

      throw error;
    }
  }

  /**
   * This customer's referral code, what it has earned, and what is still in
   * flight.
   *
   * A referred PG earns nothing until it publishes, so the pending count is
   * shown separately rather than folded into the total — otherwise someone
   * would see money they cannot have yet.
   */
  async getReferrals(userId: string): Promise<ReferralsDetail> {
    const [user, rewards, pendingReferrals] = await Promise.all([
      this.databaseService.user.findUniqueOrThrow({
        where: { id: userId },
        select: { referralCode: true },
      }),
      this.databaseService.referralReward.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          pg: { select: { name: true, pgCode: true } },
        },
      }),
      this.databaseService.pg.count({
        where: { referredById: userId, isPublished: false },
      }),
    ]);

    return {
      referralCode: user.referralCode,
      earnedRupees: rewards.reduce((total, reward) => total + reward.amount, 0),
      rewardPerReferral: this.configService.getOrThrow<number>(
        'app.listing.referralRewardRupees',
      ),
      pendingReferrals,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        pgName: reward.pg.name,
        pgCode: reward.pg.pgCode,
        amount: reward.amount,
        earnedAt: reward.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Where this person currently lives, or null if nowhere.
   *
   * The link exists because the CRM matches a resident's phone number to a Pzee
   * account when an owner adds them, so a resident sees their own room without
   * anyone having to connect the two by hand. Null is the ordinary answer for
   * someone still looking, not an error.
   */
  async getStay(userId: string): Promise<StayDetail | null> {
    const resident = await this.databaseService.resident.findFirst({
      where: { userId, status: ResidentStatus.ACTIVE },
      // Someone who moved between PGs keeps both rows; the current one is the
      // one they joined most recently.
      orderBy: { joinedAt: 'desc' },
      select: {
        id: true,
        roomType: true,
        monthlyRent: true,
        joinedAt: true,
        dueDate: true,
        room: { select: { number: true } },
        services: {
          select: { id: true, name: true, monthlyAmount: true },
          orderBy: { name: 'asc' },
        },
        pg: {
          select: {
            id: true,
            pgCode: true,
            name: true,
            location: true,
            city: true,
            logo: true,
            images: true,
            gender: true,
            foodIncluded: true,
            verification: true,
            owner: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    if (!resident) return null;

    const { pg } = resident;
    const servicesTotal = resident.services.reduce(
      (total, service) => total + service.monthlyAmount,
      0,
    );

    return {
      residentId: resident.id,
      roomNumber: resident.room?.number ?? null,
      roomType: resident.roomType,
      monthlyRent: resident.monthlyRent,
      monthlyTotal: resident.monthlyRent + servicesTotal,
      joinedAt: resident.joinedAt.toISOString(),
      dueDate: resident.dueDate ? resident.dueDate.toISOString() : null,
      services: resident.services,
      pg: {
        id: pg.id,
        pgCode: pg.pgCode,
        name: pg.name,
        location: pg.location,
        city: pg.city,
        logo: pg.logo,
        image: pg.images[0] ?? null,
        gender: pg.gender,
        foodIncluded: pg.foodIncluded,
        verification: pg.verification,
        ownerName: [pg.owner.firstName, pg.owner.lastName]
          .filter(Boolean)
          .join(' '),
        ownerPhone: pg.owner.phone,
      },
    };
  }
}

function toProfileDetail(user: ProfileRow): ProfileDetail {
  return {
    ...user,
    dateOfBirth: toDateOnly(user.dateOfBirth),
    createdAt: user.createdAt.toISOString(),
  };
}
