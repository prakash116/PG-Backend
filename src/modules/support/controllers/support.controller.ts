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
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupportTicketStatus, UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  AdminSupportTicketsResponse,
  SupportTicketResponse,
  SupportTicketsResponse,
} from '../models/support-response.model';
import { RaiseTicketDto, ResolveTicketDto } from '../models/support.dto';
import { SupportService } from '../services/support.service';

/** The PG owner's side: raise a query, and see where it got to. */
@ApiTags('Support')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PG_OWNER)
export class OwnerSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Your queries and their status',
    description: 'Newest first, with whatever Pzee replied.',
  })
  @ApiOkResponse({
    description: 'Queries retrieved successfully.',
    type: SupportTicketsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
  @ApiNotFoundResponse({ description: 'No PG is registered to this account.' })
  async listMine(
    @Req() request: AuthenticatedRequest,
  ): Promise<SupportTicketsResponse> {
    return {
      success: true,
      message: 'Queries retrieved successfully.',
      data: await this.supportService.listForOwner(request.sessionUser.id),
    };
  }

  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Raise a query with Pzee' })
  @ApiBody({ type: RaiseTicketDto })
  @ApiOkResponse({ description: 'Query raised.', type: SupportTicketResponse })
  @ApiBadRequestResponse({ description: 'Missing title or description.' })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async raise(
    @Req() request: AuthenticatedRequest,
    @Body() raiseTicketDto: RaiseTicketDto,
  ): Promise<SupportTicketResponse> {
    return {
      success: true,
      message: 'Query raised. We will get back to you.',
      data: await this.supportService.raise(
        request.sessionUser.id,
        raiseTicketDto,
      ),
    };
  }
}

/** The Super Admin's side: answer them. */
@ApiTags('Support')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({
    summary: 'Every query, open ones first',
    description: 'With the PG and the number to call back on.',
  })
  @ApiOkResponse({
    description: 'Queries retrieved successfully.',
    type: AdminSupportTicketsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async listAll(): Promise<AdminSupportTicketsResponse> {
    return {
      success: true,
      message: 'Queries retrieved successfully.',
      data: await this.supportService.listForAdmin(),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Mark a query solved or rejected',
    description: 'Answering it once is final; there is no reopening.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiBody({ type: ResolveTicketDto })
  @ApiOkResponse({ description: 'Query answered.', type: SupportTicketResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such query.' })
  @ApiConflictResponse({ description: 'That query has already been answered.' })
  async resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() resolveTicketDto: ResolveTicketDto,
  ): Promise<SupportTicketResponse> {
    const ticket = await this.supportService.resolve(
      id,
      request.sessionUser.id,
      resolveTicketDto,
    );

    return {
      success: true,
      message:
        ticket.status === SupportTicketStatus.SOLVED
          ? 'Marked solved.'
          : 'Query rejected.',
      data: ticket,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a query for good' })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({ description: 'Query removed.', type: SupportTicketResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such query.' })
  async remove(@Param('id') id: string): Promise<SupportTicketResponse> {
    const ticket = await this.supportService.remove(id);

    return {
      success: true,
      message: 'Query removed.',
      data: ticket,
    };
  }
}
