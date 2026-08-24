import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { SessionCookieService } from '../../auth/services/session-cookie.service';
import { CloseAccountResponse } from '../models/close-account-response.model';
import { ProfileResponse } from '../models/profile-response.model';
import { ReferralsResponse } from '../models/referrals-response.model';
import { RequestPayoutDto } from '../models/request-payout.dto';
import { StayResponse } from '../models/stay-response.model';
import { UpdateProfileDto } from '../models/update-profile.dto';
import {
  ACCOUNT_GRACE_DAYS,
  AccountLifecycleService,
} from '../services/account-lifecycle.service';
import { MeService } from '../services/me.service';

/**
 * Everything a signed-in person can see and change about themselves. No
 * `@Roles`, deliberately: an owner has an account too, and every route here
 * reads the id from the session rather than the URL, so one account can never
 * reach another's data.
 */
@ApiTags('Account')
@Controller()
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly accountLifecycleService: AccountLifecycleService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Read your own account',
    description:
      'The full profile, unlike GET /v1/auth/me which returns only what the header needs.',
  })
  @ApiOkResponse({
    description: 'Profile retrieved successfully.',
    type: ProfileResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async getProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileResponse> {
    return {
      success: true,
      message: 'Profile retrieved successfully.',
      data: await this.meService.getProfile(request.sessionUser.id),
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update your own account',
    description:
      'Send only the fields being changed. Role and account status are not editable here.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({
    description: 'Profile updated successfully.',
    type: ProfileResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiConflictResponse({
    description: 'That email or phone number belongs to another account.',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return {
      success: true,
      message: 'Profile updated successfully.',
      data: await this.meService.updateProfile(
        request.sessionUser.id,
        updateProfileDto,
      ),
    };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete your own account',
    description: `Closes the account at once: you are signed out and cannot sign back in. The record is kept for ${ACCOUNT_GRACE_DAYS} days so a Super Admin can restore it, then removed for good. A PG owner is refused, because removing the owner would take the PG and its payment history with it.`,
  })
  @ApiOkResponse({ description: 'Account closed.', type: CloseAccountResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiConflictResponse({
    description: 'This account cannot be deleted here.',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async deleteOwnAccount(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CloseAccountResponse> {
    const closed = await this.accountLifecycleService.close(
      request.sessionUser.id,
    );

    // Only after the close succeeds: a refusal must leave them signed in.
    this.sessionCookieService.clear(response);

    return {
      success: true,
      message: `Account closed. You have ${closed.graceDays} days to ask us to restore it.`,
      data: closed,
    };
  }

  @Get('me/referrals')
  @ApiOperation({
    summary: 'Your referral code and what it has earned',
    description:
      'A PG owner enters this code when registering. Once that PG publishes, the reward is credited here.',
  })
  @ApiOkResponse({
    description: 'Referrals retrieved successfully.',
    type: ReferralsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async getReferrals(
    @Req() request: AuthenticatedRequest,
  ): Promise<ReferralsResponse> {
    return {
      success: true,
      message: 'Referrals retrieved successfully.',
      data: await this.meService.getReferrals(request.sessionUser.id),
    };
  }

  @Post('me/referrals/payout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ask for your referral earnings to be sent',
    description:
      'Requests the whole available balance. Only one request may be open at a time; the amount stays reserved until a Super Admin settles it.',
  })
  @ApiBody({ type: RequestPayoutDto })
  @ApiOkResponse({
    description: 'Payout requested.',
    type: ReferralsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiConflictResponse({
    description: 'Nothing to pay out, or a payout is already on the way.',
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async requestPayout(
    @Req() request: AuthenticatedRequest,
    @Body() requestPayoutDto: RequestPayoutDto,
  ): Promise<ReferralsResponse> {
    const referrals = await this.meService.requestPayout(
      request.sessionUser.id,
      requestPayoutDto.upiId,
    );

    return {
      success: true,
      message: 'Payout requested. We will send it to your UPI id shortly.',
      data: referrals,
    };
  }

  @Get('me/stay')
  @ApiOperation({
    summary: 'The PG you are currently living in',
    description:
      'Resolved from the resident record an owner created for you. Returns null when you are not staying anywhere, which is not an error.',
  })
  @ApiOkResponse({
    description: 'Stay retrieved successfully.',
    type: StayResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async getStay(
    @Req() request: AuthenticatedRequest,
  ): Promise<StayResponse> {
    const stay = await this.meService.getStay(request.sessionUser.id);

    return {
      success: true,
      message: stay
        ? 'Stay retrieved successfully.'
        : 'You are not staying in a PG yet.',
      data: stay,
    };
  }
}
