import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoomType } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { CreateRoomsDto, UpdateRoomDto } from '../models/room.dto';

/** Default beds per room, by sharing type. An odd room can override it. */
const BEDS_PER_ROOM: Record<RoomType, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  PREMIUM: 1,
};

export interface RoomDetail {
  id: string;
  number: string;
  type: RoomType;
  floor: string | null;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
}

const ROOM_SELECT = {
  id: true,
  number: true,
  type: true,
  floor: true,
  totalBeds: true,
  _count: { select: { residents: { where: { status: 'ACTIVE' as const } } } },
} as const;

/**
 * Continues a numbering run: "201" then 202, 203; "G-4" then G-5, G-6. The
 * trailing digits are incremented and any prefix is kept, so an owner adds a
 * floor's worth of rooms in one go instead of typing each.
 */
function numberSequence(start: string, count: number): string[] {
  const match = start.match(/^(.*?)(\d+)$/);

  if (!match) {
    // No trailing number to continue, so only a single room makes sense.
    return [start];
  }

  const [, prefix, digits] = match;
  const width = digits.length;
  const first = Number(digits);

  return Array.from({ length: count }, (_, index) =>
    `${prefix}${String(first + index).padStart(width, '0')}`,
  );
}

@Injectable()
export class RoomsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(ownerId: string): Promise<RoomDetail[]> {
    const pgId = await this.pgIdOf(ownerId);

    const rooms = await this.databaseService.room.findMany({
      where: { pgId },
      select: ROOM_SELECT,
      orderBy: [{ type: 'asc' }, { number: 'asc' }],
    });

    return rooms.map((room) => this.present(room));
  }

  /** Creates one room, or a numbered run of them. */
  async create(ownerId: string, dto: CreateRoomsDto): Promise<RoomDetail[]> {
    const pgId = await this.pgIdOf(ownerId);

    const roomType = await this.databaseService.pgRoomType.findUnique({
      where: { pgId_type: { pgId, type: dto.type } },
      select: { type: true },
    });

    if (!roomType) {
      throw new BadRequestException(
        'Add this room type in Room management before adding rooms to it.',
      );
    }

    const numbers = numberSequence(dto.startNumber, dto.count ?? 1);
    const totalBeds = dto.totalBeds ?? BEDS_PER_ROOM[dto.type];

    const clash = await this.databaseService.room.findFirst({
      where: { pgId, number: { in: numbers } },
      select: { number: true },
    });

    if (clash) {
      throw new ConflictException(`Room ${clash.number} already exists.`);
    }

    try {
      await this.databaseService.room.createMany({
        data: numbers.map((number) => ({
          pgId,
          number,
          type: dto.type,
          floor: dto.floor,
          totalBeds,
        })),
      });
    } catch (error: unknown) {
      // Covers the race between the check above and the insert.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('One of those room numbers already exists.');
      }

      throw error;
    }

    return this.list(ownerId);
  }

  async update(
    ownerId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<RoomDetail[]> {
    const pgId = await this.pgIdOf(ownerId);
    const room = await this.findInPg(pgId, roomId);

    if (dto.totalBeds !== undefined && dto.totalBeds < room.occupiedBeds) {
      throw new BadRequestException(
        `Room ${room.number} has ${room.occupiedBeds} guest${room.occupiedBeds === 1 ? '' : 's'} in it, so it cannot drop to ${dto.totalBeds} bed${dto.totalBeds === 1 ? '' : 's'}.`,
      );
    }

    try {
      await this.databaseService.room.update({
        where: { id: roomId },
        data: { number: dto.number, floor: dto.floor, totalBeds: dto.totalBeds },
        select: { id: true },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Room ${dto.number} already exists.`);
      }

      throw error;
    }

    return this.list(ownerId);
  }

  async remove(ownerId: string, roomId: string): Promise<RoomDetail[]> {
    const pgId = await this.pgIdOf(ownerId);
    const room = await this.findInPg(pgId, roomId);

    if (room.occupiedBeds > 0) {
      throw new BadRequestException(
        `Room ${room.number} still has ${room.occupiedBeds} guest${room.occupiedBeds === 1 ? '' : 's'} in it. Move them out first.`,
      );
    }

    await this.databaseService.room.delete({ where: { id: roomId } });

    return this.list(ownerId);
  }

  private async pgIdOf(ownerId: string): Promise<string> {
    const pg = await this.databaseService.pg.findUnique({
      where: { ownerId },
      select: { id: true },
    });

    if (!pg) {
      throw new NotFoundException(
        'No PG is linked to this account yet. Register a PG to manage rooms.',
      );
    }

    return pg.id;
  }

  /** Scoped to the caller's PG, so another owner's room reads as missing. */
  private async findInPg(pgId: string, roomId: string): Promise<RoomDetail> {
    const room = await this.databaseService.room.findFirst({
      where: { id: roomId, pgId },
      select: ROOM_SELECT,
    });

    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    return this.present(room);
  }

  private present(room: {
    id: string;
    number: string;
    type: RoomType;
    floor: string | null;
    totalBeds: number;
    _count: { residents: number };
  }): RoomDetail {
    const occupiedBeds = room._count.residents;

    return {
      id: room.id,
      number: room.number,
      type: room.type,
      floor: room.floor,
      totalBeds: room.totalBeds,
      occupiedBeds,
      availableBeds: Math.max(0, room.totalBeds - occupiedBeds),
    };
  }
}
