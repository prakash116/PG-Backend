import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoomType } from '../../../generated/prisma/client';

const MAX_ROOMS = 500;
const MAX_RUPEES = 10_000_000;

export class RoomTypeInput {
  @ApiProperty({ enum: RoomType, example: RoomType.DOUBLE })
  @IsEnum(RoomType)
  type!: RoomType;

  @ApiProperty({ example: 6, description: 'How many rooms of this type.' })
  @IsInt()
  @Min(0)
  @Max(MAX_ROOMS)
  roomCount!: number;

  @ApiProperty({ example: 9800, description: 'Monthly rent per bed.' })
  @IsInt()
  @Min(0)
  @Max(MAX_RUPEES)
  pricePerBed!: number;

  @ApiProperty({
    example: 4,
    description:
      'Beds free right now. Must not exceed the beds this many rooms hold.',
  })
  @IsInt()
  @Min(0)
  availableBeds!: number;
}

/**
 * Replaces the whole set. A type left out of the payload is deleted, which is
 * how an owner stops offering it.
 */
export class UpdateRoomsDto {
  @ApiProperty({ type: [RoomTypeInput] })
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => RoomTypeInput)
  rooms!: RoomTypeInput[];
}

export class UpdateAvailabilityDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  availableBeds!: number;
}
