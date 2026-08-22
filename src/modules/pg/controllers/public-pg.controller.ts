import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseService } from '../../../database/database.service';

/**
 * The only PG route without a guard: a visitor has to be able to see a
 * listing before deciding to book. It returns nothing private — no owner
 * contact details, no guests, no verification internals.
 */
@ApiTags('PG')
@Controller()
export class PublicPgController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('public/:pgCode')
  @ApiOperation({ summary: 'Look up a PG by its shareable code' })
  @ApiParam({ name: 'pgCode', example: 'PZ-4F7K2A' })
  @ApiOkResponse({ description: 'PG retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'No PG found for that ID.' })
  async getByCode(@Param('pgCode') pgCode: string) {
    const pg = await this.databaseService.pg.findUnique({
      where: { pgCode: pgCode.trim().toUpperCase() },
      select: {
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
        logo: true,
        verification: true,
        rating: true,
        reviewCount: true,
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
      },
    });

    if (!pg) {
      throw new NotFoundException('No PG found for that ID.');
    }

    return {
      success: true,
      message: 'PG retrieved successfully.',
      data: { ...pg, verified: pg.verification === 'VERIFIED' },
    };
  }
}
