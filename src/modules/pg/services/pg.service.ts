import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  PgCompletionResponse,
  PgDetail,
  PgRoomTypeResponse,
  PgTotalsResponse,
} from '../models/pg-response.model';
import { UpdatePgDto } from '../models/update-pg.dto';
import { RoomTypeInput } from '../models/update-rooms.dto';

/** How many beds a room of each type holds, used to derive bed counts. */
const BEDS_PER_ROOM: Record<RoomType, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  PREMIUM: 1,
};

/**
 * The only PG columns an owner may write. `verification`, `verifiedAt`,
 * `rating`, `reviewCount`, `pgCode` and `ownerId` are deliberately absent.
 */
const WRITABLE_FIELDS = [
  'name',
  'location',
  'city',
  'description',
  'price',
  'deposit',
  'gender',
  'cooling',
  'foodIncluded',
  'foodDetails',
  'amenities',
  'images',
] as const satisfies ReadonlyArray<keyof UpdatePgDto>;

/** Sections the dashboard progress meter counts. */
const COMPLETION_CHECKS: Array<{
  label: string;
  isDone: (pg: PgWithRooms) => boolean;
}> = [
  { label: 'Description', isDone: (pg) => Boolean(pg.description?.trim()) },
  { label: 'Monthly rent', isDone: (pg) => pg.price !== null },
  { label: 'Security deposit', isDone: (pg) => pg.deposit !== null },
  { label: 'PG type', isDone: (pg) => pg.gender !== null },
  { label: 'Cooling', isDone: (pg) => pg.cooling !== null },
  { label: 'Amenities', isDone: (pg) => pg.amenities.length > 0 },
  { label: 'Photos', isDone: (pg) => pg.images.length > 0 },
  { label: 'Rooms and pricing', isDone: (pg) => pg.roomTypes.length > 0 },
];

const PG_SELECT = {
  id: true,
  pgCode: true,
  name: true,
  location: true,
  city: true,
  description: true,
  price: true,
  deposit: true,
  gender: true,
  cooling: true,
  foodIncluded: true,
  foodDetails: true,
  amenities: true,
  images: true,
  verification: true,
  rating: true,
  reviewCount: true,
  updatedAt: true,
  roomTypes: {
    select: {
      type: true,
      roomCount: true,
      pricePerBed: true,
      totalBeds: true,
      availableBeds: true,
    },
    orderBy: { type: 'asc' },
  },
} as const;

type PgWithRooms = {
  id: string;
  pgCode: string;
  name: string;
  location: string;
  city: string | null;
  description: string | null;
  price: number | null;
  deposit: number | null;
  gender: PgDetail['gender'];
  cooling: PgDetail['cooling'];
  foodIncluded: boolean;
  foodDetails: string | null;
  amenities: string[];
  images: string[];
  verification: PgDetail['verification'];
  rating: number;
  reviewCount: number;
  updatedAt: Date;
  roomTypes: PgRoomTypeResponse[];
};

@Injectable()
export class PgService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** The signed-in owner's PG. The owner comes from the session, never the URL. */
  async getOwnerPg(ownerId: string): Promise<PgDetail> {
    return this.present(await this.findByOwner(ownerId));
  }

  async updateOwnerPg(ownerId: string, dto: UpdatePgDto): Promise<PgDetail> {
    const pg = await this.findByOwner(ownerId);
    const data = this.pickWritable(dto);

    // An empty body would otherwise bump updatedAt and report a false save.
    if (Object.keys(data).length === 0) {
      return this.present(pg);
    }

    const updated = await this.databaseService.pg.update({
      where: { id: pg.id },
      data,
      select: PG_SELECT,
    });

    return this.present(updated as PgWithRooms);
  }

  /**
   * Copies only the fields an owner may change. The DTO has no `verification`
   * or `rating` key and the global ValidationPipe strips unknown ones, but
   * spreading the body straight into Prisma would make privilege escalation a
   * single config change away. Naming the writable fields keeps that closed
   * however this method is called.
   */
  private pickWritable(dto: UpdatePgDto): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    for (const field of WRITABLE_FIELDS) {
      const value = dto[field];

      // undefined means "leave unchanged", which is what PATCH implies.
      if (value !== undefined) {
        data[field] = value;
      }
    }

    return data;
  }

  /**
   * Replaces the room-type set in one transaction: types missing from the
   * payload are removed, so an owner can stop offering a type.
   */
  async replaceRooms(
    ownerId: string,
    rooms: RoomTypeInput[],
  ): Promise<PgDetail> {
    const pg = await this.findByOwner(ownerId);

    this.assertNoDuplicateTypes(rooms);

    const prepared = rooms.map((room) => {
      const totalBeds = room.roomCount * BEDS_PER_ROOM[room.type];

      if (room.availableBeds > totalBeds) {
        throw new BadRequestException(
          `${this.describe(room.type)}: ${room.availableBeds} available beds is more than the ${totalBeds} these rooms hold.`,
        );
      }

      return { ...room, totalBeds };
    });

    await this.databaseService.$transaction(async (tx) => {
      await tx.pgRoomType.deleteMany({
        where: {
          pgId: pg.id,
          type: { notIn: prepared.map((room) => room.type) },
        },
      });

      for (const room of prepared) {
        await tx.pgRoomType.upsert({
          where: { pgId_type: { pgId: pg.id, type: room.type } },
          update: {
            roomCount: room.roomCount,
            pricePerBed: room.pricePerBed,
            totalBeds: room.totalBeds,
            availableBeds: room.availableBeds,
          },
          create: {
            pgId: pg.id,
            type: room.type,
            roomCount: room.roomCount,
            pricePerBed: room.pricePerBed,
            totalBeds: room.totalBeds,
            availableBeds: room.availableBeds,
          },
        });
      }
    });

    return this.getOwnerPg(ownerId);
  }

  /** The one edit an owner makes often, so it has its own small endpoint. */
  async updateAvailability(
    ownerId: string,
    type: RoomType,
    availableBeds: number,
  ): Promise<PgDetail> {
    const pg = await this.findByOwner(ownerId);
    const room = pg.roomTypes.find((entry) => entry.type === type);

    if (!room) {
      throw new NotFoundException(
        `This PG does not offer ${this.describe(type)} rooms yet.`,
      );
    }

    if (availableBeds > room.totalBeds) {
      throw new BadRequestException(
        `${this.describe(type)}: ${availableBeds} available beds is more than the ${room.totalBeds} these rooms hold.`,
      );
    }

    await this.databaseService.pgRoomType.update({
      where: { pgId_type: { pgId: pg.id, type } },
      data: { availableBeds },
      select: { type: true },
    });

    return this.getOwnerPg(ownerId);
  }

  private async findByOwner(ownerId: string): Promise<PgWithRooms> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: PG_SELECT,
    });

    if (!pg) {
      // Reachable for owner accounts created before PGs existed.
      throw new NotFoundException(
        'No PG is linked to this account yet. Register a PG to manage it here.',
      );
    }

    return pg as PgWithRooms;
  }

  private assertNoDuplicateTypes(rooms: RoomTypeInput[]): void {
    const seen = new Set<RoomType>();

    for (const room of rooms) {
      if (seen.has(room.type)) {
        throw new BadRequestException(
          `${this.describe(room.type)} is listed more than once.`,
        );
      }

      seen.add(room.type);
    }
  }

  private describe(type: RoomType): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  private totals(roomTypes: PgRoomTypeResponse[]): PgTotalsResponse {
    const sum = (pick: (room: PgRoomTypeResponse) => number): number =>
      roomTypes.reduce((running, room) => running + pick(room), 0);

    const availableBeds = sum((room) => room.availableBeds);

    return {
      rooms: sum((room) => room.roomCount),
      beds: sum((room) => room.totalBeds),
      availableBeds,
      isAvailable: availableBeds > 0,
    };
  }

  private completion(pg: PgWithRooms): PgCompletionResponse {
    const missing = COMPLETION_CHECKS.filter(
      (check) => !check.isDone(pg),
    ).map((check) => check.label);

    const done = COMPLETION_CHECKS.length - missing.length;

    return {
      percent: Math.round((done / COMPLETION_CHECKS.length) * 100),
      missing,
    };
  }

  private present(pg: PgWithRooms): PgDetail {
    return {
      ...pg,
      verified: pg.verification === 'VERIFIED',
      updatedAt: pg.updatedAt.toISOString(),
      totals: this.totals(pg.roomTypes),
      completion: this.completion(pg),
    };
  }
}
