import { Controller, Get } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersListResponse } from '../models/users-list-response.model';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    type: UsersListResponse,
  })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  getAllUsers(): Promise<UsersListResponse> {
    return this.usersService.getAllUsers();
  }
}
