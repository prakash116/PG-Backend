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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  CrmSummaryResponse,
  ResidentListResponse,
  ResidentResponse,
} from '../models/resident-response.model';
import {
  CreatePaymentDto,
  CreateResidentDto,
  CrmSummaryQuery,
  ListResidentsQuery,
  UpdateResidentDto,
} from '../models/resident.dto';
import { CrmService } from '../services/crm.service';
import { PaymentsService } from '../services/payments.service';

@ApiTags('CRM')
@Controller()
// JwtAuthGuard must run first: it populates the session user RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PG_OWNER)
@ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
@ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
@ApiNotFoundResponse({ description: 'No PG is linked to this account.' })
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('me/residents')
  @ApiOperation({
    summary: 'List the guests staying in your PG',
    description:
      'Defaults to guests currently staying. Pass status=LEFT for past guests, or search by name or phone.',
  })
  @ApiOkResponse({
    description: 'Guests retrieved successfully.',
    type: ResidentListResponse,
  })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListResidentsQuery,
  ): Promise<ResidentListResponse> {
    return {
      success: true,
      message: 'Guests retrieved successfully.',
      data: await this.crmService.list(request.sessionUser.id, query),
    };
  }

  @Post('me/residents')
  @ApiOperation({
    summary: 'Add a guest',
    description:
      'Takes a bed in the chosen room type, and links the guest to their Pzee account when their phone matches one.',
  })
  @ApiOkResponse({
    description: 'Guest added successfully.',
    type: ResidentResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation error, or that room type has no free bed.',
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createResidentDto: CreateResidentDto,
  ): Promise<ResidentResponse> {
    return {
      success: true,
      message: 'Guest added successfully.',
      data: await this.crmService.create(
        request.sessionUser.id,
        createResidentDto,
      ),
    };
  }

  @Patch('me/residents/:id')
  @ApiOperation({ summary: 'Edit a guest' })
  @ApiOkResponse({
    description: 'Guest updated successfully.',
    type: ResidentResponse,
  })
  @ApiBadRequestResponse({ description: 'Validation error, or the new room type is full.' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateResidentDto: UpdateResidentDto,
  ): Promise<ResidentResponse> {
    return {
      success: true,
      message: 'Guest updated successfully.',
      data: await this.crmService.update(
        request.sessionUser.id,
        id,
        updateResidentDto,
      ),
    };
  }

  @Post('me/residents/:id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a guest out',
    description: 'Marks them as moved out, which returns their bed to the pool.',
  })
  @ApiOkResponse({
    description: 'Guest checked out successfully.',
    type: ResidentResponse,
  })
  @ApiBadRequestResponse({ description: 'The guest has already checked out.' })
  async checkout(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ResidentResponse> {
    return {
      success: true,
      message: 'Guest checked out successfully.',
      data: await this.crmService.checkout(request.sessionUser.id, id),
    };
  }

  @Delete('me/residents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a guest record',
    description:
      'For a mistaken entry. Their payment records go with them. Use checkout for someone who genuinely moved out.',
  })
  @ApiNoContentResponse({ description: 'Guest deleted.' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.crmService.remove(request.sessionUser.id, id);
  }

  @Post('me/residents/:id/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a rent payment' })
  @ApiOkResponse({
    description: 'Payment recorded successfully.',
    type: ResidentResponse,
  })
  @ApiBadRequestResponse({ description: 'Amount below 1, or a future date.' })
  async addPayment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<ResidentResponse> {
    return {
      success: true,
      message: 'Payment recorded successfully.',
      data: await this.crmService.addPayment(
        request.sessionUser.id,
        id,
        createPaymentDto,
      ),
    };
  }

  @Get('me/payments/summary')
  @ApiOperation({
    summary: 'Total earnings, dues and recent payments',
    description:
      'Earnings are every payment ever recorded. Collected covers the given period, defaulting to this month.',
  })
  @ApiOkResponse({ description: 'Summary retrieved successfully.' })
  @ApiBadRequestResponse({ description: 'The start date is after the end date.' })
  async payments(
    @Req() request: AuthenticatedRequest,
    @Query() query: CrmSummaryQuery,
  ) {
    return {
      success: true,
      message: 'Summary retrieved successfully.',
      data: await this.paymentsService.summary(request.sessionUser.id, query),
    };
  }

  @Get('me/crm/summary')
  @ApiOperation({
    summary: 'Guests, dues and collections',
    description:
      'Collections cover the given period, defaulting to this month. Pass the same date as from and to for a single day.',
  })
  @ApiOkResponse({
    description: 'Summary retrieved successfully.',
    type: CrmSummaryResponse,
  })
  @ApiBadRequestResponse({ description: 'The start date is after the end date.' })
  async summary(
    @Req() request: AuthenticatedRequest,
    @Query() query: CrmSummaryQuery,
  ): Promise<CrmSummaryResponse> {
    return {
      success: true,
      message: 'Summary retrieved successfully.',
      data: await this.crmService.summary(request.sessionUser.id, query),
    };
  }
}
