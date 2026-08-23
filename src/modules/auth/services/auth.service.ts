import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '../../../generated/prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { isUniqueConstraintOn } from '../../../database/prisma-errors';
import { LoginDto } from '../models/login.dto';
import { LoginResponse } from '../models/login-response.model';
import { RegisterDto } from '../models/register.dto';
import { RegisterResponse } from '../models/register-response.model';
import { generatePgCode } from './pg-code';
import { SessionTokenPayload } from './session-cookie.service';

interface BcryptApi {
  hash(value: string, saltRounds: number): Promise<string>;
  compare(value: string, encryptedValue: string): Promise<boolean>;
}

/** The controller writes `tokenPayload` to the session cookie and returns `body`. */
export interface LoginResult {
  tokenPayload: SessionTokenPayload;
  body: LoginResponse;
}

/** Registration signs the visitor in, so it returns a token payload too. */
export interface RegisterResult {
  tokenPayload: SessionTokenPayload;
  body: RegisterResponse;
}

const bcrypt = require('bcrypt') as BcryptApi;
const BCRYPT_SALT_ROUNDS = 10;

/** A generated PG code can collide; retry a few times before giving up. */
const PG_CODE_ATTEMPTS = 5;

const REGISTERED_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  userType: true,
  profileImage: true,
  createdAt: true,
} as const;

const REGISTERED_PG_SELECT = {
  id: true,
  pgCode: true,
  name: true,
  location: true,
} as const;

/**
 * The form collects one name box, while the database keeps the first and last
 * name apart. Everything after the first space becomes the last name.
 */
function splitFullName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
}


@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async login(loginDto: LoginDto): Promise<LoginResult> {
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

    await this.databaseService.user.update({
      where: { id: user.id },
      data: { lastLogin },
      select: { id: true },
    });

    return {
      tokenPayload: { sub: user.id, role: user.role },
      body: {
        success: true,
        message: 'Login successful.',
        data: {
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
      },
    };
  }

  /**
   * Registers a PG seeker or a PG owner through one endpoint. An owner's PG is
   * created in the same transaction, so an owner never exists without a PG.
   */
  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    // The DTO already limits the role, but an account that could grant itself
    // admin is worth guarding twice.
    if (registerDto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin registration is not allowed.');
    }

    await this.assertIdentifiersAreFree(registerDto.email, registerDto.phone);

    const password = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );
    const { firstName, lastName } = splitFullName(registerDto.fullName);
    const isOwner = registerDto.role === UserRole.PG_OWNER;

    for (let attempt = 1; attempt <= PG_CODE_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.databaseService.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              firstName,
              lastName,
              email: registerDto.email,
              phone: registerDto.phone,
              password,
              role: registerDto.role,
              userType: registerDto.userType,
              gender: registerDto.gender,
              dateOfBirth: registerDto.dateOfBirth
                ? new Date(registerDto.dateOfBirth)
                : undefined,
              profileImage: registerDto.profileImage,
              country: registerDto.country,
              state: registerDto.state,
              city: registerDto.city,
              address: registerDto.address,
              pincode: registerDto.pincode,
            },
            select: REGISTERED_USER_SELECT,
          });

          if (!isOwner) {
            return { user, pg: null };
          }

          const pg = await tx.pg.create({
            data: {
              pgCode: generatePgCode(),
              name: registerDto.pgName as string,
              location: registerDto.pgLocation as string,
              ownerId: user.id,
            },
            select: REGISTERED_PG_SELECT,
          });

          return { user, pg };
        });

        return {
          tokenPayload: { sub: created.user.id, role: created.user.role },
          body: {
            success: true,
            message: 'Registration successful.',
            data: {
              ...created.user,
              createdAt: created.user.createdAt.toISOString(),
              pg: created.pg,
            },
          },
        };
      } catch (error: unknown) {
        // A duplicate PG code is pure bad luck: roll back and draw another.
        if (
          isUniqueConstraintOn(error, 'pgcode') &&
          attempt < PG_CODE_ATTEMPTS
        ) {
          continue;
        }

        this.throwForDuplicateIdentifier(error);
        throw new InternalServerErrorException('Internal Server Error.');
      }
    }

    throw new InternalServerErrorException(
      'Could not allocate a unique PG ID. Please try again.',
    );
  }

  /** Checked up front so the caller gets a clear 409 instead of a database error. */
  private async assertIdentifiersAreFree(
    email: string,
    phone: string,
  ): Promise<void> {
    const existing = await this.databaseService.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });

    if (!existing) {
      return;
    }

    throw new ConflictException(
      existing.email === email
        ? 'Email already exists.'
        : 'Phone already exists.',
    );
  }

  /** Covers the race between the check above and the insert. */
  private throwForDuplicateIdentifier(error: unknown): void {
    if (isUniqueConstraintOn(error, 'email')) {
      throw new ConflictException('Email already exists.');
    }

    if (isUniqueConstraintOn(error, 'phone')) {
      throw new ConflictException('Phone already exists.');
    }
  }
}
