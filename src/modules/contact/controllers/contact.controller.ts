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
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  ContactEnquiriesResponse,
  ContactEnquiryResponse,
  EnquirySentResponse,
} from '../models/contact-response.model';
import { CreateEnquiryDto } from '../models/contact.dto';
import { ContactService } from '../services/contact.service';

/** The public Contact Us form. No session required. */
@ApiTags('Contact')
@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Five a minute per address. The form is open to the internet, and without
  // this it is a free way to fill the table.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Send a message from the Contact Us form',
    description: 'Open to anyone. Nothing is returned but a confirmation.',
  })
  @ApiBody({ type: CreateEnquiryDto })
  @ApiOkResponse({ description: 'Message sent.', type: EnquirySentResponse })
  @ApiBadRequestResponse({ description: 'A field is missing or invalid.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  async send(
    @Body() createEnquiryDto: CreateEnquiryDto,
  ): Promise<EnquirySentResponse> {
    await this.contactService.create(createEnquiryDto);

    return {
      success: true,
      message: 'Thanks — we have your message and will call you back.',
    };
  }
}

/** Working through them. Super Admin only. */
@ApiTags('Contact')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({
    summary: 'Every enquiry, new ones first',
  })
  @ApiOkResponse({
    description: 'Enquiries retrieved successfully.',
    type: ContactEnquiriesResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async list(): Promise<ContactEnquiriesResponse> {
    return {
      success: true,
      message: 'Enquiries retrieved successfully.',
      data: await this.contactService.list(),
    };
  }

  @Patch(':id/resolve')
  @ApiOperation({
    summary: 'Mark an enquiry resolved',
    description: 'Once resolved it stays resolved; there is no reopening.',
  })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({
    description: 'Marked resolved.',
    type: ContactEnquiryResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such enquiry.' })
  @ApiConflictResponse({ description: 'That enquiry is already resolved.' })
  async resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ContactEnquiryResponse> {
    return {
      success: true,
      message: 'Marked resolved.',
      data: await this.contactService.resolve(id, request.sessionUser.id),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an enquiry for good' })
  @ApiParam({ name: 'id', example: 'cm1234567890' })
  @ApiOkResponse({
    description: 'Enquiry removed.',
    type: ContactEnquiryResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No such enquiry.' })
  async remove(@Param('id') id: string): Promise<ContactEnquiryResponse> {
    const enquiry = await this.contactService.remove(id);

    return {
      success: true,
      message: `Enquiry from ${enquiry.name} removed.`,
      data: enquiry,
    };
  }
}
