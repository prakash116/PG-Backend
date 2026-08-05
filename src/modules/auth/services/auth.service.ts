import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, UserRole } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { RegisterDto } from '../models/register.dto';
import { RegisterResponse } from '../models/register-response.model';

interface BcryptApi {
  hash(value: string, saltRounds: number): Promise<string>;
}

const bcrypt = require('bcrypt') as BcryptApi;
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    if (registerDto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin registration is not allowed.');
    }

    const emailExists = await this.databaseService.user.findUnique({
      where: { email: registerDto.email },
      select: { id: true },
    });

    if (emailExists) {
      throw new ConflictException('Email already exists.');
    }

    const phoneExists = await this.databaseService.user.findUnique({
      where: { phone: registerDto.phone },
      select: { id: true },
    });

    if (phoneExists) {
      throw new ConflictException('Phone already exists.');
    }

    const password = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      const user = await this.databaseService.user.create({
        data: {
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          email: registerDto.email,
          phone: registerDto.phone,
          password,
          role: registerDto.role,
          userType: registerDto.userType,
          gender: registerDto.gender,
          dateOfBirth: registerDto.dateOfBirth
            ? new Date(registerDto.dateOfBirth)
            : undefined,
          country: registerDto.country,
          state: registerDto.state,
          city: registerDto.city,
          address: registerDto.address,
          pincode: registerDto.pincode,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          userType: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        message: 'Registration successful.',
        data: {
          ...user,
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (error: unknown) {
      this.handleUniqueConstraint(error);
      throw new InternalServerErrorException('Internal Server Error.');
    }
  }

  private handleUniqueConstraint(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = error.meta?.target;
    const constraint = Array.isArray(target)
      ? target.join(' ').toLowerCase()
      : String(target ?? '').toLowerCase();

    if (constraint.includes('email')) {
      throw new ConflictException('Email already exists.');
    }

    if (constraint.includes('phone')) {
      throw new ConflictException('Phone already exists.');
    }
  }
}
