import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
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
import { ConfirmFeeDto } from '../models/confirm-fee.dto';
import {
  PendingFeesResponse,
  PublishStatusResponse,
} from '../models/publishing-response.model';
import { PublishingService } from '../services/publishing.service';

/**
 * Publishing a listing. The owner asks; a Super Admin, having received the fee,
 * is the one who makes it public.
 */
@ApiTags('Publishing')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get('me/publish')
  @Roles(UserRole.PG_OWNER)
  @ApiOperation({
    summary: 'Where your listing stands',
    description:
      'Whether the PG is public, what publishing costs, where to send it, and the state of any fee already raised.',
  })
  @ApiOkResponse({
    description: 'Publish status retrieved.',
    type: PublishStatusResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
  @ApiNotFoundResponse({ description: 'No PG is registered to this account.' })
  async getPublishStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<PublishStatusResponse> {
    return {
      success: true,
      message: 'Publish status retrieved.',
      data: await this.publishingService.statusForOwner(
        request.sessionUser.id,
      ),
    };
  }

  @Post('me/publish')
  @Roles(UserRole.PG_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ask to publish your PG',
    description:
      'Raises the one-off listing fee and returns where to pay it. The PG stays private until a Super Admin confirms the money arrived. Pressing it twice does not raise a second fee.',
  })
  @ApiOkResponse({
    description: 'Publish requested.',
    type: PublishStatusResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the PG Owner role.' })
  @ApiConflictResponse({ description: 'This PG is already published.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async requestPublish(
    @Req() request: AuthenticatedRequest,
  ): Promise<PublishStatusResponse> {
    const status = await this.publishingService.requestPublish(
      request.sessionUser.id,
    );

    return {
      success: true,
      message: status.isPublished
        ? 'Your PG is published.'
        : `Send ₹${status.feeRupees} to publish. Your PG goes live once we confirm it.`,
      data: status,
    };
  }

  @Get('listing-fees/pending')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Listing fees awaiting confirmation',
    description: 'Super Admin only.',
  })
  @ApiOkResponse({
    description: 'Pending listing fees retrieved.',
    type: PendingFeesResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async getPendingFees(): Promise<PendingFeesResponse> {
    return {
      success: true,
      message: 'Pending listing fees retrieved.',
      data: await this.publishingService.pendingFees(),
    };
  }

  @Post('listing-fees/:pgCode/confirm')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a listing fee arrived',
    description:
      'Super Admin only. Publishes the PG and credits the referring customer, both in one transaction. This is the hook a payment gateway will call.',
  })
  @ApiParam({ name: 'pgCode', example: 'PZ-X6QQVD' })
  @ApiOkResponse({
    description: 'Fee confirmed.',
    type: PublishStatusResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No PG with that code.' })
  @ApiConflictResponse({ description: 'Already confirmed, or never requested.' })
  async confirmFee(
    @Req() request: AuthenticatedRequest,
    @Param('pgCode') pgCode: string,
    @Body() confirmFeeDto: ConfirmFeeDto,
  ): Promise<PublishStatusResponse> {
    return {
      success: true,
      message: 'Fee confirmed. The PG is now published.',
      data: await this.publishingService.confirmFee(
        pgCode.trim().toUpperCase(),
        request.sessionUser.id,
        confirmFeeDto.reference,
      ),
    };
  }
}
