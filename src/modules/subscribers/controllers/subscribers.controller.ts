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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubscriberStatus, UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SubscribeDto } from '../models/subscribe.dto';
import {
  SubscribeResponse,
  SubscriberResponse,
  SubscribersListResponse,
} from '../models/subscriber-response.model';
import { UpdateSubscriberDto } from '../models/update-subscriber.dto';
import { SubscribersService } from '../services/subscribers.service';

/** The public sign-up form. No session required — anyone may subscribe. */
@ApiTags('Subscribers')
@Controller()
export class SubscribeController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // Five a minute per address. The form is open to the internet, and without
  // this it is a free way to fill the table.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Subscribe to PG updates',
    description:
      'Open to anyone. Subscribing twice is not an error and reports the same message, so the form cannot be used to test which addresses are on the list.',
  })
  @ApiBody({ type: SubscribeDto })
  @ApiOkResponse({ description: 'Subscribed.', type: SubscribeResponse })
  @ApiBadRequestResponse({ description: 'That is not a valid email address.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async subscribe(
    @Body() subscribeDto: SubscribeDto,
  ): Promise<SubscribeResponse> {
    await this.subscribersService.subscribe(subscribeDto.email);

    return {
      success: true,
      message: "You're subscribed. PG updates are on their way.",
    };
  }
}

/** Managing the list. Super Admin only. */
@ApiTags('Subscribers')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminSubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Get()
  @ApiOperation({ summary: 'Every subscriber, newest first' })
  @ApiOkResponse({
    description: 'Subscribers retrieved successfully.',
    type: SubscribersListResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async list(): Promise<SubscribersListResponse> {
    return {
      success: true,
      message: 'Subscribers retrieved successfully.',
      data: await this.subscribersService.list(),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Block a subscriber, or unblock one',
    description: 'A blocked address stays on the list but receives nothing.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiBody({ type: UpdateSubscriberDto })
  @ApiOkResponse({ description: 'Subscriber updated.', type: SubscriberResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such subscriber.' })
  async setStatus(
    @Param('id') id: string,
    @Body() updateSubscriberDto: UpdateSubscriberDto,
  ): Promise<SubscriberResponse> {
    const subscriber = await this.subscribersService.setStatus(
      id,
      updateSubscriberDto.status,
    );

    return {
      success: true,
      message:
        subscriber.status === SubscriberStatus.BLOCKED
          ? `${subscriber.email} is blocked and will not receive email.`
          : `${subscriber.email} will receive email again.`,
      data: subscriber,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove a subscriber for good',
    description: 'A real delete. Use block to stop the email but keep the row.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({ description: 'Subscriber removed.', type: SubscriberResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such subscriber.' })
  async remove(@Param('id') id: string): Promise<SubscriberResponse> {
    const subscriber = await this.subscribersService.remove(id);

    return {
      success: true,
      message: `${subscriber.email} removed.`,
      data: subscriber,
    };
  }
}
