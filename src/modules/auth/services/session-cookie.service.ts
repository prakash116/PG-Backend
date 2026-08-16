/** Issues and clears the HttpOnly session cookie that carries the JWT. */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions, Response } from 'express';
import { UserRole } from '../../../generated/prisma/client';

export interface SessionTokenPayload {
  sub: string;
  role: UserRole;
}

@Injectable()
export class SessionCookieService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Signs a session token and writes it to the cookie. Called on login and on
   * every session check, so an active user keeps a rolling 30-day session.
   */
  async issue(
    response: Response,
    payload: SessionTokenPayload,
  ): Promise<void> {
    const token = await this.jwtService.signAsync(payload);
    response.cookie(this.cookieName, token, this.cookieOptions());
  }

  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    response.clearCookie(this.cookieName, options);
  }

  get cookieName(): string {
    return this.configService.getOrThrow<string>('app.session.cookieName');
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.getOrThrow<boolean>('app.session.cookieSecure'),
      sameSite: this.configService.getOrThrow<'lax' | 'strict' | 'none'>(
        'app.session.cookieSameSite',
      ),
      domain: this.configService.get<string>('app.session.cookieDomain'),
      path: '/',
      maxAge: this.configService.getOrThrow<number>('app.session.maxAgeMs'),
    };
  }
}
