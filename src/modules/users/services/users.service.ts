import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { UsersListResponse } from '../models/users-list-response.model';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAllUsers(): Promise<UsersListResponse> {
    const users = await this.databaseService.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        userType: true,
        profileImage: true,
        state: true,
        city: true,
        // The admin page has to tell a live account from a closed one to know
        // whether to offer Delete or Restore.
        isActive: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Users retrieved successfully.',
      data: users.map((user) => ({
        ...user,
        deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }
}
