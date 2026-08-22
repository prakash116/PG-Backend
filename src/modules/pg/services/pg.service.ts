import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  PgCompletionResponse,
  PgDetail,
  PgRoomTypeResponse,
  PgTotalsResponse,
} from '../models/pg-response.model';
import { StorageService } from '../../uploads/services/storage.service';
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
  'logo',
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
  logo: true,
  amenities: true,
  images: true,
  verification: true,
  rating: true,
  reviewCount: true,
  updatedAt: true,
  roomTypes: {
    select: {
      type: true,
      pricePerBed: true,
      roomImage1: true,
      roomImage2: true,
      bathroomImage: true,
      otherImage: true,
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
  logo: string | null;
  amenities: string[];
  images: string[];
  verification: PgDetail['verification'];
  rating: number;
  reviewCount: number;
  updatedAt: Date;
  roomTypes: PgRoomTypeResponse[];
};

/** The four photo slots on a room type, in the order they are shown. */
const ROOM_IMAGE_FIELDS = [
  'roomImage1',
  'roomImage2',
  'bathroomImage',
  'otherImage',
] as const;

@Injectable()
export class PgService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  /** The signed-in owner's PG. The owner comes from the session, never the URL. */
  async getOwnerPg(ownerId: string): Promise<PgDetail> {
    const pg = await this.findByOwner(ownerId);

    return this.present(
      pg,
      await this.occupancyOf(pg.id),
      await this.inventoryOf(pg.id),
    );
  }

  async updateOwnerPg(ownerId: string, dto: UpdatePgDto): Promise<PgDetail> {
    const pg = await this.findByOwner(ownerId);
    const data = this.pickWritable(dto);

    // An empty body would otherwise bump updatedAt and report a false save.
    if (Object.keys(data).length === 0) {
      return this.present(
        pg,
        await this.occupancyOf(pg.id),
        await this.inventoryOf(pg.id),
      );
    }

    const updated = await this.databaseService.pg.update({
      where: { id: pg.id },
      data,
      select: PG_SELECT,
    });

    // Photos dropped from the gallery are removed from storage too, so an
    // account does not accumulate files nothing points at any more.
    if (data.images !== undefined) {
      const kept = new Set(updated.images);
      void this.storageService.deleteImages(
        pg.images.filter((url) => !kept.has(url)),
      );
    }

    // A replaced or removed logo would otherwise leave its file behind.
    if (pg.logo && pg.logo !== updated.logo) {
      void this.storageService.deleteImage(pg.logo);
    }

    return this.present(
      updated as PgWithRooms,
      await this.occupancyOf(pg.id),
      await this.inventoryOf(pg.id),
    );
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

    const prepared = rooms;

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
            pricePerBed: room.pricePerBed,
            roomImage1: room.roomImage1,
            roomImage2: room.roomImage2,
            bathroomImage: room.bathroomImage,
            otherImage: room.otherImage,
          },
          create: {
            pgId: pg.id,
            type: room.type,
            pricePerBed: room.pricePerBed,
            roomImage1: room.roomImage1,
            roomImage2: room.roomImage2,
            bathroomImage: room.bathroomImage,
            otherImage: room.otherImage,
          },
        });
      }
    });

    // Replaced photos, and every photo of a room type that was dropped, are
    // no longer referenced by anything — remove them from storage.
    void this.storageService.deleteImages(
      this.orphanedRoomImages(pg.roomTypes, prepared),
    );

    return this.getOwnerPg(ownerId);
  }

  /**
   * Photo URLs the old room types held that the new ones no longer do. Covers
   * both a slot being replaced and a whole room type being removed.
   */
  private orphanedRoomImages(
    before: PgRoomTypeResponse[],
    after: RoomTypeInput[],
  ): string[] {
    const orphans: string[] = [];

    for (const old of before) {
      const replacement = after.find((room) => room.type === old.type);

      for (const field of ROOM_IMAGE_FIELDS) {
        const previous = old[field];

        // Unchanged slots, and slots that were empty, have nothing to clean up.
        if (!previous || previous === replacement?.[field]) {
          continue;
        }

        orphans.push(previous);
      }
    }

    return orphans;
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

  /**
   * How many beds each room type has taken right now, counted from the guests
   * recorded in the CRM. Availability is derived rather than stored, so the
   * dashboard and the public listing can never drift apart.
   */
  private async inventoryOf(
    pgId: string,
  ): Promise<Partial<Record<RoomType, { roomCount: number; totalBeds: number }>>> {
    const rooms = await this.databaseService.room.groupBy({
      by: ['type'],
      _count: { _all: true },
      _sum: { totalBeds: true },
      where: { pgId },
    });

    return Object.fromEntries(
      rooms.map((row) => [
        row.type,
        { roomCount: row._count._all, totalBeds: row._sum.totalBeds ?? 0 },
      ]),
    );
  }

  private async occupancyOf(pgId: string): Promise<Partial<Record<RoomType, number>>> {
    const grouped = await this.databaseService.resident.groupBy({
      by: ['roomType'],
      where: { pgId, status: 'ACTIVE' },
      _count: { _all: true },
    });

    return Object.fromEntries(
      grouped.map((row) => [row.roomType, row._count._all]),
    );
  }

  private present(
    pg: PgWithRooms,
    occupancy: Partial<Record<RoomType, number>>,
    inventory: Partial<Record<RoomType, { roomCount: number; totalBeds: number }>>,
  ): PgDetail {
    const roomTypes = pg.roomTypes.map((room) => {
      const stock = inventory[room.type] ?? { roomCount: 0, totalBeds: 0 };

      return {
        ...room,
        roomCount: stock.roomCount,
        totalBeds: stock.totalBeds,
        // Never fewer than zero free beds, even if guest records outnumber the
        // beds after rooms were removed.
        availableBeds: Math.max(
          0,
          stock.totalBeds - (occupancy[room.type] ?? 0),
        ),
      };
    });

    return {
      ...pg,
      roomTypes,
      verified: pg.verification === 'VERIFIED',
      updatedAt: pg.updatedAt.toISOString(),
      totals: this.totals(roomTypes),
      completion: this.completion(pg),
    };
  }
}
