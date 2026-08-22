import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { CreateRoomsDto, UpdateRoomDto } from '../models/room.dto';
import { RoomDetail, RoomsService } from '../services/rooms.service';

interface RoomsResponse {
  success: true;
  message: string;
  data: RoomDetail[];
}

@ApiTags('Rooms')
@Controller()
// JwtAuthGuard must run first: it populates the session user RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PG_OWNER)
@ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
@ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
@ApiNotFoundResponse({ description: 'No PG is linked to this account.' })
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('me/rooms')
  @ApiOperation({
    summary: 'List the rooms in your PG',
    description: 'Each room reports its beds and how many are taken.',
  })
  @ApiOkResponse({ description: 'Rooms retrieved successfully.' })
  async list(@Req() request: AuthenticatedRequest): Promise<RoomsResponse> {
    return {
      success: true,
      message: 'Rooms retrieved successfully.',
      data: await this.roomsService.list(request.sessionUser.id),
    };
  }

  @Post('me/rooms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a room, or a numbered run of them',
    description:
      'startNumber 201 with count 6 creates 201 through 206, so a floor is added in one go.',
  })
  @ApiOkResponse({ description: 'Rooms added successfully.' })
  @ApiBadRequestResponse({ description: 'That room type is not offered yet.' })
  @ApiConflictResponse({ description: 'A room with that number already exists.' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createRoomsDto: CreateRoomsDto,
  ): Promise<RoomsResponse> {
    return {
      success: true,
      message: 'Rooms added successfully.',
      data: await this.roomsService.create(
        request.sessionUser.id,
        createRoomsDto,
      ),
    };
  }

  @Patch('me/rooms/:id')
  @ApiOperation({ summary: 'Rename a room or change its beds' })
  @ApiOkResponse({ description: 'Room updated successfully.' })
  @ApiBadRequestResponse({
    description: 'Fewer beds than the guests already in the room.',
  })
  @ApiConflictResponse({ description: 'A room with that number already exists.' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ): Promise<RoomsResponse> {
    return {
      success: true,
      message: 'Room updated successfully.',
      data: await this.roomsService.update(
        request.sessionUser.id,
        id,
        updateRoomDto,
      ),
    };
  }

  @Delete('me/rooms/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a room',
    description: 'Refused while anyone is still staying in it.',
  })
  @ApiOkResponse({ description: 'Room deleted successfully.' })
  @ApiBadRequestResponse({ description: 'The room still has guests in it.' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<RoomsResponse> {
    return {
      success: true,
      message: 'Room deleted successfully.',
      data: await this.roomsService.remove(request.sessionUser.id, id),
    };
  }
}
