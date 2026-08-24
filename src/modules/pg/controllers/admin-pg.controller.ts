import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, VerificationStatus } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  AdminPgActionResponse,
  AdminPgDetailResponse,
  AdminPgListResponse,
} from '../models/admin-pg-response.model';
import { AdminUpdatePgDto } from '../models/admin-pg.dto';
import { AdminPgService } from '../services/admin-pg.service';

/** Every listing on the platform. Super Admin only. */
@ApiTags('Admin PG')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminPgController {
  constructor(private readonly adminPgService: AdminPgService) {}

  @Get('admin/list')
  @ApiOperation({
    summary: 'Every PG, newest first',
    description:
      'With its owner, listing-fee status, room and bed counts, residents and rent collected.',
  })
  @ApiOkResponse({
    description: 'PGs retrieved successfully.',
    type: AdminPgListResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  async list(): Promise<AdminPgListResponse> {
    return {
      success: true,
      message: 'PGs retrieved successfully.',
      data: await this.adminPgService.list(),
    };
  }

  @Get('admin/:pgCode')
  @ApiOperation({
    summary: 'One PG in full',
    description:
      'Its room types, every room with occupancy, every resident, and twelve months of collections.',
  })
  @ApiParam({ name: 'pgCode', example: 'PZ-X6QQVD' })
  @ApiOkResponse({
    description: 'PG retrieved successfully.',
    type: AdminPgDetailResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No PG with that code.' })
  async detail(
    @Param('pgCode') pgCode: string,
  ): Promise<AdminPgDetailResponse> {
    return {
      success: true,
      message: 'PG retrieved successfully.',
      data: await this.adminPgService.detail(pgCode.trim().toUpperCase()),
    };
  }

  @Patch('admin/:pgCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a listing, or take it off the site',
    description:
      'Hiding a PG leaves the owner their dashboard, rooms and guests — it only stops the listing being found.',
  })
  @ApiParam({ name: 'pgCode', example: 'PZ-X6QQVD' })
  @ApiBody({ type: AdminUpdatePgDto })
  @ApiOkResponse({ description: 'PG updated.', type: AdminPgActionResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No PG with that code.' })
  async update(
    @Param('pgCode') pgCode: string,
    @Body() adminUpdatePgDto: AdminUpdatePgDto,
  ): Promise<AdminPgActionResponse> {
    const pg = await this.adminPgService.update(
      pgCode.trim().toUpperCase(),
      adminUpdatePgDto,
    );

    return {
      success: true,
      message: messageFor(pg.name, adminUpdatePgDto),
      data: pg,
    };
  }

  @Delete('admin/:pgCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a listing for good',
    description:
      'Removes the PG with its rooms, residents, services, payments, visits and support queries. The owner keeps their account.',
  })
  @ApiParam({ name: 'pgCode', example: 'PZ-X6QQVD' })
  @ApiOkResponse({ description: 'PG deleted.', type: AdminPgActionResponse })
  @ApiUnauthorizedResponse({ description: 'Session is missing or expired.' })
  @ApiForbiddenResponse({ description: 'Requires the Super Admin role.' })
  @ApiNotFoundResponse({ description: 'No PG with that code.' })
  async remove(
    @Param('pgCode') pgCode: string,
  ): Promise<AdminPgActionResponse> {
    const pg = await this.adminPgService.remove(pgCode.trim().toUpperCase());

    return {
      success: true,
      message: `${pg.name} deleted.`,
      data: pg,
    };
  }
}

function messageFor(name: string, dto: AdminUpdatePgDto): string {
  if (dto.verification === VerificationStatus.VERIFIED) {
    return `${name} is verified.`;
  }

  if (dto.verification !== undefined) {
    return `${name} is no longer verified.`;
  }

  return dto.isPublished
    ? `${name} is back on the site.`
    : `${name} is hidden from the site.`;
}
