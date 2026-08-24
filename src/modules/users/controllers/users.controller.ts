import {
  Body,
  ConflictException,
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
import { UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BlockAccountDto } from '../models/block-account.dto';
import { CloseAccountResponse } from '../models/close-account-response.model';
import { UserStatsQuery } from '../models/user-stats-query.dto';
import { UserStatsResponse } from '../models/user-stats-response.model';
import { UsersListResponse } from '../models/users-list-response.model';
import { UserStatsService } from '../services/user-stats.service';
import {
  ACCOUNT_GRACE_DAYS,
  AccountLifecycleService,
} from '../services/account-lifecycle.service';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountLifecycleService: AccountLifecycleService,
    private readonly userStatsService: UserStatsService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Super Admin only. Requires a valid session cookie carrying the SUPER_ADMIN role.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    type: UsersListResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  getAllUsers(): Promise<UsersListResponse> {
    return this.usersService.getAllUsers();
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Sign-ups over a date range',
    description:
      'One point per day, including empty days, plus a running total. Defaults to the last 30 days.',
  })
  @ApiOkResponse({
    description: 'Sign-up stats retrieved successfully.',
    type: UserStatsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async getStats(@Query() query: UserStatsQuery): Promise<UserStatsResponse> {
    return {
      success: true,
      message: 'Sign-up stats retrieved successfully.',
      data: await this.userStatsService.signups(query),
    };
  }

  @Patch(':id/block')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block an account, or unblock one',
    description:
      'A blocked account cannot sign in and its existing session stops working on the next request. Reversible at any time; nothing is deleted.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiBody({ type: BlockAccountDto })
  @ApiOkResponse({ description: 'Account updated.', type: CloseAccountResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'Account not found.' })
  @ApiConflictResponse({ description: 'Already in that state, or a Super Admin.' })
  async setBlocked(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() blockAccountDto: BlockAccountDto,
  ): Promise<CloseAccountResponse> {
    if (id === request.sessionUser.id) {
      throw new ConflictException('You cannot block your own admin account.');
    }

    const account = await this.accountLifecycleService.setBlocked(
      id,
      blockAccountDto.blocked,
    );

    return {
      success: true,
      message: blockAccountDto.blocked
        ? `${account.name} is blocked and cannot sign in.`
        : `${account.name} can sign in again.`,
      data: account,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an account',
    description: `Super Admin only. Closes the account at once and keeps the record for ${ACCOUNT_GRACE_DAYS} days, after which it is removed for good. Closing a PG owner unpublishes their PG immediately; the purge then takes the PG, its rooms, residents and payments with it. Super Admin accounts are refused.`,
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({ description: 'Account closed.', type: CloseAccountResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'Account not found.' })
  @ApiConflictResponse({ description: 'This account cannot be deleted.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<CloseAccountResponse> {
    // The service already refuses a Super Admin, so this only ever fires for an
    // admin aiming at themselves. Worth its own message all the same.
    if (id === request.sessionUser.id) {
      throw new ConflictException('You cannot delete your own admin account.');
    }

    const closed = await this.accountLifecycleService.close(id);

    return {
      success: true,
      message: `Account closed. Restorable for ${closed.graceDays} days.`,
      data: closed,
    };
  }

  @Post(':id/restore')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a closed account',
    description:
      'Super Admin only. Works until the account is purged, after which there is nothing left to restore.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({
    description: 'Account restored.',
    type: CloseAccountResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'Account not found.' })
  @ApiConflictResponse({ description: 'This account is not closed.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async restoreAccount(
    @Param('id') id: string,
  ): Promise<CloseAccountResponse> {
    const restored = await this.accountLifecycleService.restore(id);

    return {
      success: true,
      message: 'Account restored.',
      data: restored,
    };
  }
}
