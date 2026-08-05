import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { LoginDto } from '../models/login.dto';
import { LoginResponse } from '../models/login-response.model';
import { RegisterDto } from '../models/register.dto';
import { RegisterResponse } from '../models/register-response.model';

interface BcryptApi {
  hash(value: string, saltRounds: number): Promise<string>;
  compare(value: string, encryptedValue: string): Promise<boolean>;
}

const bcrypt = require('bcrypt') as BcryptApi;
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const identifier = loginDto.identifier;
    const user = await this.databaseService.user.findUnique({
      where: identifier.includes('@')
        ? { email: identifier }
        : { phone: identifier },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        userType: true,
        profileImage: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid email/phone or password.');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Your account has been blocked.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is inactive.');
    }

    const lastLogin = new Date();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    await this.databaseService.user.update({
      where: { id: user.id },
      data: { lastLogin },
      select: { id: true },
    });

    return {
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          userType: user.userType,
          profileImage: user.profileImage,
          lastLogin: lastLogin.toISOString(),
        },
      },
    };
  }

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
