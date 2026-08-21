import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UsersListResponse } from '../models/users-list-response.model';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller()
// Order matters: JwtAuthGuard populates the session user that RolesGuard reads.
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
