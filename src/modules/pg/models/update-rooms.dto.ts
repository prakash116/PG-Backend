import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoomType } from '../../../generated/prisma/client';

const MAX_ROOMS = 500;
const MAX_RUPEES = 10_000_000;

/** An absolute URL, or a path served by this API. */
const IMAGE_PATTERN = /^(https?:\/\/|\/)[^\s]+$/;

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Each photo slot carries the same rules; only the message differs, so the
 * owner is told exactly which of the four is missing.
 */
function ImageSlot(label: string): PropertyDecorator {
  return function apply(target: object, key: string | symbol): void {
    Transform(trimString)(target, key);
    IsString({ message: `${label} is required.` })(target, key);
    MaxLength(2048)(target, key);
    Matches(IMAGE_PATTERN, {
      message: `${label} must be a URL or an uploaded image path.`,
    })(target, key);
    IsNotEmpty({ message: `${label} is required.` })(target, key);
  };
}

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

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../room-1.jpg',
    description: 'First photo of the room itself.',
  })
  @ImageSlot('First room photo')
  roomImage1!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../room-2.jpg',
    description: 'Second photo of the room itself.',
  })
  @ImageSlot('Second room photo')
  roomImage2!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../bathroom.jpg',
    description: 'Photo of the bathroom or toilet.',
  })
  @ImageSlot('Bathroom photo')
  bathroomImage!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../kitchen.jpg',
    description: 'One more photo: kitchen, balcony, or anything else.',
  })
  @ImageSlot('Kitchen or other photo')
  otherImage!: string;
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
