import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import {
  CreateVisitDto,
  ListVisitsQuery,
  UpdateVisitDto,
} from '../models/visit.dto';
import { VisitDetail, VisitsService } from '../services/visits.service';

interface VisitResponse {
  success: true;
  message: string;
  data: VisitDetail;
}

interface VisitListResponse {
  success: true;
  message: string;
  data: VisitDetail[];
}

@ApiTags('Visits')
@Controller()
// Booking requires an account, so the owner always gets real contact details.
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Sign in to book a visit.' })
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Book a visit to a PG',
    description:
      'The customer is taken from the session, and their name, phone and email are sent to the owner.',
  })
  @ApiOkResponse({ description: 'Visit booked successfully.' })
  @ApiBadRequestResponse({
    description: 'Already booked, or it is your own PG.',
  })
  @ApiNotFoundResponse({ description: 'No PG found for that ID.' })
  async book(
    @Req() request: AuthenticatedRequest,
    @Body() createVisitDto: CreateVisitDto,
  ): Promise<VisitResponse> {
    return {
      success: true,
      message: 'Visit booked successfully.',
      data: await this.visitsService.book(
        request.sessionUser.id,
        createVisitDto,
      ),
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Visits the signed-in customer has booked' })
  @ApiOkResponse({ description: 'Visits retrieved successfully.' })
  async listMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<VisitListResponse> {
    return {
      success: true,
      message: 'Visits retrieved successfully.',
      data: await this.visitsService.listForCustomer(request.sessionUser.id),
    };
  }
}

@ApiTags('Visits')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PG_OWNER)
@ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
@ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
@ApiNotFoundResponse({ description: 'No PG is linked to this account.' })
export class OwnerVisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get('me/visits')
  @ApiOperation({
    summary: 'Visit requests for your PG',
    description: 'Every customer who asked to see the place, newest first.',
  })
  @ApiOkResponse({ description: 'Visits retrieved successfully.' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListVisitsQuery,
  ): Promise<VisitListResponse> {
    return {
      success: true,
      message: 'Visits retrieved successfully.',
      data: await this.visitsService.listForOwner(
        request.sessionUser.id,
        query,
      ),
    };
  }

  @Patch('me/visits/:id')
  @ApiOperation({
    summary: 'Confirm, complete or cancel a visit request',
  })
  @ApiOkResponse({ description: 'Visit updated successfully.' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateVisitDto: UpdateVisitDto,
  ): Promise<VisitResponse> {
    return {
      success: true,
      message: 'Visit updated successfully.',
      data: await this.visitsService.updateStatus(
        request.sessionUser.id,
        id,
        updateVisitDto.status,
      ),
    };
  }
}
