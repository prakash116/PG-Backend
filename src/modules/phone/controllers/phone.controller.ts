import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { VerificationPolicyResponse } from '../../mail/models/mail-response.model';
import { PlatformSettingsService } from '../../mail/services/platform-settings.service';
import {
  PhoneVerifiedResponse,
  SmsSettingsResponse,
  WidgetConfigResponse,
} from '../models/phone-response.model';
import {
  SetPhonePolicyDto,
  UpdateSmsSettingsDto,
  VerifyPhoneTokenDto,
} from '../models/phone.dto';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { SmsSettingsService } from '../services/sms-settings.service';

/**
 * Verifying a mobile number. Public, because it runs on the registration form
 * before any account exists. The MSG91 widget sends and checks the code in
 * the browser; these routes hand the register page the widget's configuration
 * and confirm its access token server-side.
 */
@ApiTags('Phone verification')
@Controller()
export class PhoneVerificationController {
  constructor(
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly smsSettingsService: SmsSettingsService,
  ) {}

  @Get('widget-config')
  @ApiOperation({
    summary: 'What the register page needs to run the MSG91 widget',
    description:
      'Widget id and token auth are client-side values by MSG91 design. The account authkey is never part of this.',
  })
  @ApiOkResponse({
    description: 'Widget configuration retrieved.',
    type: WidgetConfigResponse,
  })
  async widgetConfig(): Promise<WidgetConfigResponse> {
    const config = await this.smsSettingsService.widgetConfig();

    return {
      success: true,
      message: config.configured
        ? 'Widget configuration retrieved.'
        : 'SMS verification is not configured yet.',
      data: config,
    };
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  // Ten a minute — this is the endpoint someone would hammer with stolen or
  // fabricated tokens, and each call costs an MSG91 API request.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: "Confirm the widget's access token and record the number as verified",
    description:
      'On success the number counts as verified for the next 30 minutes, which is what registration looks for. The token is confirmed with MSG91 directly — the browser is never trusted to assert it.',
  })
  @ApiBody({ type: VerifyPhoneTokenDto })
  @ApiOkResponse({
    description: 'Mobile number verified.',
    type: PhoneVerifiedResponse,
  })
  @ApiBadRequestResponse({
    description: 'The token was refused, or belongs to a different number.',
  })
  @ApiServiceUnavailableResponse({
    description: 'SMS is not set up, or MSG91 could not be reached.',
  })
  async verifyToken(
    @Body() verifyPhoneTokenDto: VerifyPhoneTokenDto,
  ): Promise<PhoneVerifiedResponse> {
    await this.phoneVerificationService.verifyToken(
      verifyPhoneTokenDto.phone,
      verifyPhoneTokenDto.accessToken,
    );

    return { success: true, message: 'Mobile number verified.' };
  }
}

/** The MSG91 account Pzee verifies through. Super Admin only. */
@ApiTags('Phone verification')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SmsSettingsController {
  constructor(
    private readonly smsSettingsService: SmsSettingsService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'The MSG91 account in use',
    description:
      'The authkey is never returned — only whether one is stored, and where the settings came from.',
  })
  @ApiOkResponse({
    description: 'SMS settings retrieved successfully.',
    type: SmsSettingsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async settings(): Promise<SmsSettingsResponse> {
    return {
      success: true,
      message: 'SMS settings retrieved successfully.',
      data: await this.smsSettingsService.detail(),
    };
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Change the MSG91 account',
    description:
      'Leave the authkey blank to keep the one already stored. Takes effect on the next verification, with no redeploy.',
  })
  @ApiBody({ type: UpdateSmsSettingsDto })
  @ApiOkResponse({
    description: 'SMS settings saved.',
    type: SmsSettingsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() updateSmsSettingsDto: UpdateSmsSettingsDto,
  ): Promise<SmsSettingsResponse> {
    return {
      success: true,
      message: 'SMS settings saved.',
      data: await this.smsSettingsService.update(
        updateSmsSettingsDto,
        request.sessionUser.id,
      ),
    };
  }

  @Patch('settings/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Require a verified number at registration, or stop requiring one',
    description:
      'Off means an account can be created without proving the number. Takes effect on the next registration.',
  })
  @ApiBody({ type: SetPhonePolicyDto })
  @ApiOkResponse({
    description: 'Policy saved.',
    type: VerificationPolicyResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async setPolicy(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetPhonePolicyDto,
  ): Promise<VerificationPolicyResponse> {
    const policy =
      await this.platformSettingsService.setRequirePhoneVerification(
        dto.required,
        request.sessionUser.id,
      );

    return {
      success: true,
      message: policy.requirePhoneVerification
        ? 'New accounts must verify their mobile number.'
        : 'New accounts can register without verifying their mobile number.',
      data: policy,
    };
  }
}
