import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PgResponse } from '../models/pg-response.model';
import { UpdatePgDto } from '../models/update-pg.dto';
import { UpdateRoomsDto } from '../models/update-rooms.dto';
import { PgService } from '../services/pg.service';

@ApiTags('PG')
@Controller()
// JwtAuthGuard must run first: it populates the session user RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PG_OWNER)
@ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
@ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
@ApiNotFoundResponse({ description: 'No PG is linked to this account.' })
export class PgController {
  constructor(private readonly pgService: PgService) {}

  @Get('me')
  @ApiOperation({
    summary: "Read the signed-in owner's PG",
    description:
      'The owner is taken from the session cookie, so one owner can never read another owner PG.',
  })
  @ApiOkResponse({ description: 'PG retrieved successfully.', type: PgResponse })
  async getMyPg(@Req() request: AuthenticatedRequest): Promise<PgResponse> {
    return {
      success: true,
      message: 'PG retrieved successfully.',
      data: await this.pgService.getOwnerPg(request.sessionUser.id),
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update PG details',
    description:
      'Accepts any subset of fields, so the dashboard can save one section at a time. Verification status and ratings are not writable here.',
  })
  @ApiOkResponse({ description: 'PG updated successfully.', type: PgResponse })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  async updateMyPg(
    @Req() request: AuthenticatedRequest,
    @Body() updatePgDto: UpdatePgDto,
  ): Promise<PgResponse> {
    return {
      success: true,
      message: 'PG updated successfully.',
      data: await this.pgService.updateOwnerPg(
        request.sessionUser.id,
        updatePgDto,
      ),
    };
  }

  @Put('me/room-types')
  @ApiOperation({
    summary: 'Replace the room types you offer',
    description:
      'Sends the full set: price and photos per sharing type. A type left out is removed. Actual rooms are managed separately under me/rooms.',
  })
  @ApiOkResponse({ description: 'Rooms updated successfully.', type: PgResponse })
  @ApiBadRequestResponse({
    description: 'Duplicate room type in the payload.',
  })
  async replaceRooms(
    @Req() request: AuthenticatedRequest,
    @Body() updateRoomsDto: UpdateRoomsDto,
  ): Promise<PgResponse> {
    return {
      success: true,
      message: 'Rooms updated successfully.',
      data: await this.pgService.replaceRooms(
        request.sessionUser.id,
        updateRoomsDto.rooms,
      ),
    };
  }
}
