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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EmailOtpPurpose, UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  MailSettingsResponse,
  MailTestResponse,
  OtpSentResponse,
  OtpVerifiedResponse,
  VerificationPolicyResponse,
} from '../models/mail-response.model';
import {
  SendOtpDto,
  SetVerificationPolicyDto,
  TestMailDto,
  UpdateMailSettingsDto,
  VerifyOtpDto,
} from '../models/mail.dto';
import { EmailOtpService } from '../services/email-otp.service';
import { MailSettingsService } from '../services/mail-settings.service';
import { MailerService } from '../services/mailer.service';
import { PlatformSettingsService } from '../services/platform-settings.service';
import { otpEmailHtml, otpEmailText } from '../templates/otp-email';

/**
 * Verifying an email address. Public, because it runs on the registration form
 * before any account exists.
 */
@ApiTags('Email verification')
@Controller()
export class EmailVerificationController {
  constructor(
    private readonly emailOtpService: EmailOtpService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get('verification-policy')
  @ApiOperation({
    summary: 'Whether registration has to prove the email address',
    description:
      'Public, because the registration form reads it to decide whether to ask for a code. The API enforces it regardless of what the form does.',
  })
  @ApiOkResponse({
    description: 'Policy retrieved.',
    type: VerificationPolicyResponse,
  })
  async policy(): Promise<VerificationPolicyResponse> {
    const policy = await this.platformSettingsService.policy();

    return {
      success: true,
      message: policy.requireEmailVerification
        ? 'Email verification is required.'
        : 'Email verification is optional.',
      data: policy,
    };
  }

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  // Three a minute per address. Each one sends a real email, so this is both a
  // cost control and the thing that stops the form being used to spam someone.
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({
    summary: 'Send a six-digit code to an email address',
    description:
      'Any earlier code for the address stops working. There is a one-minute wait before another can be sent.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({ description: 'Code sent.', type: OtpSentResponse })
  @ApiBadRequestResponse({ description: 'That is not a valid email address.' })
  @ApiConflictResponse({ description: 'A code was sent very recently.' })
  @ApiServiceUnavailableResponse({ description: 'Email is not set up yet.' })
  async sendCode(@Body() sendOtpDto: SendOtpDto): Promise<OtpSentResponse> {
    const sent = await this.emailOtpService.send(
      sendOtpDto.email,
      EmailOtpPurpose.REGISTRATION,
      sendOtpDto.name,
    );

    return {
      success: true,
      message: 'Code sent. Check your inbox.',
      data: {
        expiresAt: sent.expiresAt.toISOString(),
        resendAfterSeconds: sent.resendAfterSeconds,
      },
    };
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  // Ten a minute. Six digits is a million combinations; without this it is a
  // few hours of guessing.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Check a six-digit code',
    description:
      'On success the address counts as verified for the next 30 minutes, which is what registration looks for.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({ description: 'Email verified.', type: OtpVerifiedResponse })
  @ApiBadRequestResponse({
    description: 'Wrong, expired, or too many tries.',
  })
  async verifyCode(
    @Body() verifyOtpDto: VerifyOtpDto,
  ): Promise<OtpVerifiedResponse> {
    await this.emailOtpService.verify(
      verifyOtpDto.email,
      verifyOtpDto.code,
      EmailOtpPurpose.REGISTRATION,
    );

    return { success: true, message: 'Email verified.' };
  }
}

/** The account Pzee sends from. Super Admin only. */
@ApiTags('Email verification')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class MailSettingsController {
  constructor(
    private readonly mailSettingsService: MailSettingsService,
    private readonly mailerService: MailerService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'The mail account in use',
    description:
      'The password is never returned — only whether one is stored, and where the settings came from.',
  })
  @ApiOkResponse({
    description: 'Mail settings retrieved successfully.',
    type: MailSettingsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async settings(): Promise<MailSettingsResponse> {
    return {
      success: true,
      message: 'Mail settings retrieved successfully.',
      data: await this.mailSettingsService.detail(),
    };
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Change the mail account',
    description:
      'Leave the password blank to keep the one already stored. Takes effect on the next email, with no redeploy.',
  })
  @ApiBody({ type: UpdateMailSettingsDto })
  @ApiOkResponse({
    description: 'Mail settings saved.',
    type: MailSettingsResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() updateMailSettingsDto: UpdateMailSettingsDto,
  ): Promise<MailSettingsResponse> {
    return {
      success: true,
      message: 'Mail settings saved.',
      data: await this.mailSettingsService.update(
        updateMailSettingsDto,
        request.sessionUser.id,
      ),
    };
  }

  @Patch('settings/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Require a code at registration, or stop requiring one',
    description:
      'Off means an account can be created without proving the address. Takes effect on the next registration.',
  })
  @ApiBody({ type: SetVerificationPolicyDto })
  @ApiOkResponse({
    description: 'Policy saved.',
    type: VerificationPolicyResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async setPolicy(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetVerificationPolicyDto,
  ): Promise<VerificationPolicyResponse> {
    const policy = await this.platformSettingsService.setRequireEmailVerification(
      dto.required,
      request.sessionUser.id,
    );

    return {
      success: true,
      message: policy.requireEmailVerification
        ? 'New accounts must verify their email.'
        : 'New accounts can register without verifying their email.',
      data: policy,
    };
  }

  @Post('settings/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a test email',
    description:
      'Proves the credentials work and that a real message arrives, without waiting for someone to register.',
  })
  @ApiBody({ type: TestMailDto })
  @ApiOkResponse({ description: 'Test email sent.', type: MailTestResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiServiceUnavailableResponse({
    description: 'The mail server refused the connection.',
  })
  async sendTest(@Body() testMailDto: TestMailDto): Promise<MailTestResponse> {
    // Checked first, so a bad password fails with the server's own words
    // rather than as a generic send failure.
    await this.mailerService.verifyConnection();

    await this.mailerService.send({
      to: testMailDto.email,
      subject: '123456 is your Pzee verification code',
      text: otpEmailText({ code: '123456', minutes: 10, name: 'there' }),
      html: otpEmailHtml({ code: '123456', minutes: 10, name: 'there' }),
    });

    return {
      success: true,
      message: `Test email sent to ${testMailDto.email}.`,
    };
  }
}
