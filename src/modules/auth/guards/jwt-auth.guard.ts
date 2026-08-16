/** Authenticates a request from the JWT stored in the HttpOnly session cookie. */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DatabaseService } from '../../../database/database.service';
import { SessionUser } from '../models/session-response.model';
import {
  SessionCookieService,
  SessionTokenPayload,
} from '../services/session-cookie.service';

export interface AuthenticatedRequest extends Request {
  sessionUser: SessionUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[
      this.sessionCookieService.cookieName
    ] as unknown;

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Authentication required.');
    }

    let payload: SessionTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<SessionTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        userType: true,
        profileImage: true,
        lastLogin: true,
        isActive: true,
        isBlocked: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Your account has been blocked.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is inactive.');
    }

    request.sessionUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      userType: user.userType,
      profileImage: user.profileImage,
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
    };

    return true;
  }
}
