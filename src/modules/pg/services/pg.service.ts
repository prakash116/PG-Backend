import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { isTransactionTimeout } from '../../../database/prisma-errors';
import {
  PgCompletionResponse,
  PgDetail,
  PgRoomTypeResponse,
  PgTotalsResponse,
} from '../models/pg-response.model';
import { StorageService } from '../../uploads/services/storage.service';
import { UpdatePgDto } from '../models/update-pg.dto';
import { RoomTypeInput } from '../models/update-rooms.dto';
import { BEDS_PER_ROOM } from './rooms.service';

/** One room as the planner needs it: enough to decide, nothing more. */
interface ExistingRoom {
  id: string;
  number: string;
  type: RoomType;
  /** How many guests are in it. Anything above zero makes it undeletable. */
  residents: number;
}

/** The writes a save needs, worked out before the transaction opens. */
interface RoomPlan {
  create: Array<{
    pgId: string;
    number: string;
    type: RoomType;
    totalBeds: number;
  }>;
  deleteIds: string[];
}

/**
 * Free room numbers, continuing the run the owner already uses: a PG numbered
 * 101–116 gets 117 next. A PG with no numeric rooms starts at 101, which reads
 * as a room number in a way that "1" does not.
 */
function nextRoomNumbers(taken: Set<string>, count: number): string[] {
  const numeric = [...taken]
    .map((number) => Number.parseInt(number, 10))
    .filter((number) => Number.isFinite(number));

  let candidate = numeric.length > 0 ? Math.max(...numeric) + 1 : 101;
  const numbers: string[] = [];

  while (numbers.length < count) {
    const next = String(candidate);

    // A non-numeric name like "G-4" can still collide with a plain number.
    if (!taken.has(next)) {
      taken.add(next);
      numbers.push(next);
    }

    candidate += 1;
  }

  return numbers;
}

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

    // Neither depends on the other, and a round trip to the pooler costs about
    // 400 ms, so awaiting them in turn spent that twice for no reason.
    const [occupancy, inventory] = await Promise.all([
      this.occupancyOf(pg.id),
      this.inventoryOf(pg.id),
    ]);

    return this.present(pg, occupancy, inventory);
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
    this.assertNoDuplicateTypes(rooms);

    const prepared = rooms;

    // Read once, outside the transaction, and both at the same time.
    // Everything the plan needs — the rooms of each type and the numbers
    // already in use — comes from one query, where doing it per room type cost
    // three round trips each and is what blew the transaction budget.
    const [pg, existing] = await Promise.all([
      this.findByOwner(ownerId),
      this.roomsOfOwner(ownerId),
    ]);

    // Throws if a shrink would strand a guest, before anything has been written.
    const plan = this.planRooms(pg.id, existing, prepared);

    try {
      await this.databaseService.$transaction(
        async (tx) => {
          await tx.pgRoomType.deleteMany({
            where: {
              pgId: pg.id,
              type: { notIn: prepared.map((room) => room.type) },
            },
          });

          // The room type carries price and photos; the rooms themselves live
          // in their own table, and the dashboard's counts are taken from it.
          // These upserts have to come first either way: Room's foreign key
          // points at (pgId, type).
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

          // Deletes before creates, so a number freed by a shrink can be reused
          // by a growth in the same save without tripping the unique constraint.
          if (plan.deleteIds.length > 0) {
            await tx.room.deleteMany({ where: { id: { in: plan.deleteIds } } });
          }

          if (plan.create.length > 0) {
            await tx.room.createMany({ data: plan.create });
          }
        },
        // The restructure above is what keeps this inside the budget; the
        // raised ceiling is headroom for a slow moment on a ~400 ms link,
        // not the fix.
        { timeout: 20_000, maxWait: 15_000 },
      );
    } catch (error: unknown) {
      // "Internal server error" tells the owner nothing they can act on.
      if (isTransactionTimeout(error)) {
        throw new ServiceUnavailableException(
          'Saving took too long. Check your connection and try again.',
        );
      }

      throw error;
    }

    // Replaced photos, and every photo of a room type that was dropped, are
    // no longer referenced by anything — remove them from storage.
    void this.storageService.deleteImages(
      this.orphanedRoomImages(pg.roomTypes, prepared),
    );

    return this.getOwnerPg(ownerId);
  }

  /**
   * Every room in this owner's PG, keyed off the owner so it can be read
   * alongside the PG itself rather than after it.
   */
  private async roomsOfOwner(ownerId: string): Promise<ExistingRoom[]> {
    const rooms = await this.databaseService.room.findMany({
      where: { pg: { ownerId } },
      select: {
        id: true,
        number: true,
        type: true,
        _count: { select: { residents: true } },
      },
    });

    return rooms.map((room) => ({
      id: room.id,
      number: room.number,
      type: room.type,
      residents: room._count.residents,
    }));
  }

  /**
   * Works out which rooms to create and which to remove so the actual rooms
   * match the counts the owner asked for.
   *
   * Deliberately does no querying: it is handed every room in the PG and
   * returns a plan. Doing this per room type, inside the transaction, meant
   * three extra round trips per type — and at ~400 ms to the Supabase pooler,
   * four room types blew Prisma's 5-second transaction budget and the save
   * failed with P2028.
   *
   * A room with someone living in it is never removed. `Resident.roomId` is
   * `SetNull`, so deleting an occupied room would not fail — it would quietly
   * leave a guest with no room, which is worse than refusing the save. That
   * refusal is raised here, before the transaction opens, because a save that
   * cannot proceed never needed one.
   */
  private planRooms(
    pgId: string,
    existing: ExistingRoom[],
    wanted: RoomTypeInput[],
  ): RoomPlan {
    const taken = new Set(existing.map((room) => room.number));
    const create: RoomPlan['create'] = [];
    const deleteIds: string[] = [];

    for (const { type, roomCount: target } of wanted) {
      // Oldest number first, so the numbers an owner has been using longest are
      // the ones that survive a shrink.
      const ofType = existing
        .filter((room) => room.type === type)
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

      if (ofType.length === target) continue;

      if (ofType.length < target) {
        for (const number of nextRoomNumbers(taken, target - ofType.length)) {
          create.push({ pgId, number, type, totalBeds: BEDS_PER_ROOM[type] });
        }

        continue;
      }

      const surplus = ofType.length - target;
      const empty = ofType.filter((room) => room.residents === 0);

      if (empty.length < surplus) {
        const occupied = ofType.length - empty.length;

        throw new ConflictException(
          `${this.describe(type)}: ${occupied} room${occupied === 1 ? ' has' : 's have'} guests in ${occupied === 1 ? 'it' : 'them'}, so you cannot go below ${occupied}. Move the guests out first.`,
        );
      }

      for (const room of empty.slice(-surplus)) {
        deleteIds.push(room.id);
        // Freed within this same save, so the number can be reused below.
        taken.delete(room.number);
      }
    }

    return { create, deleteIds };
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
