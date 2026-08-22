import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '../../../generated/prisma/client';

const MAX_ROOMS_PER_REQUEST = 100;

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateRoomsDto {
  @ApiProperty({ enum: RoomType })
  @IsEnum(RoomType)
  type!: RoomType;

  @ApiProperty({
    example: '201',
    description:
      'The first room number. With `count`, numbers run on from here: 201, 202, 203.',
  })
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  @IsNotEmpty({ message: 'A room needs a number.' })
  startNumber!: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'How many rooms to create in one go. Defaults to 1.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ROOMS_PER_REQUEST)
  count?: number;

  @ApiPropertyOptional({ example: '2nd floor' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Beds in each room. Defaults to what the sharing type holds.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalBeds?: number;
}

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: '201' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsNotEmpty({ message: 'A room needs a number.' })
  number?: string;

  @ApiPropertyOptional({ example: '2nd floor' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  totalBeds?: number;
}
