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

type SameSite = 'lax' | 'strict' | 'none';

/**
 * Suffixes under which each label is a separate owner, so browsers treat the
 * children as different sites. `pg-backend-pozw.onrender.com` and
 * `other.onrender.com` are no more related than two unrelated domains.
 */
const PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'co.in',
  'net.in',
  'org.in',
  'com.au',
  'co.nz',
  'co.jp',
  'com.br',
  'co.za',
  'onrender.com',
  'vercel.app',
  'netlify.app',
  'github.io',
  'pages.dev',
  'herokuapp.com',
]);

/**
 * The part of a hostname that decides its "site". SameSite compares this, not
 * the full host: `api.pzee.in` and `www.pzee.in` are the same site, while
 * `pzee.in` and `pg-backend-pozw.onrender.com` are not.
 */
function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);

  if (labels.length <= 2) return labels.join('.');

  const lastTwo = labels.slice(-2).join('.');

  return PUBLIC_SUFFIXES.has(lastTwo)
    ? labels.slice(-3).join('.')
    : lastTwo;
}

function hostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function isWithinCookieDomain(host: string, domain: string): boolean {
  const scope = domain.replace(/^\./, '').toLowerCase();
  const name = host.toLowerCase();

  return name === scope || name.endsWith(`.${scope}`);
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
    response.cookie(this.cookieName, token, this.cookieOptions(response));
  }

  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions(response);
    response.clearCookie(this.cookieName, options);
  }

  get cookieName(): string {
    return this.configService.getOrThrow<string>('app.session.cookieName');
  }

  /**
   * The attributes are settled per request, from the request itself, because
   * configuration is a statement of intent and the request is the ground truth.
   * A value left over in a hosting dashboard — or copied from a local `.env` —
   * otherwise produces a cookie the browser silently refuses to send back, and
   * the symptom is a successful login followed immediately by
   * "Authentication required".
   */
  private cookieOptions(response: Response): CookieOptions {
    const request = response.req;
    // `hostname` honours X-Forwarded-Host, which is what a TLS-terminating
    // platform such as Render sends. `trust proxy` is enabled in main.ts.
    const host = request?.hostname ?? '';
    const originHeader = request?.headers?.origin;
    const originHost = originHeader ? hostOfOrigin(originHeader) : null;

    // No Origin header means a same-origin or non-browser request, which needs
    // no relaxation. An unparseable Origin is treated as cross-site: the looser
    // cookie still works everywhere, a stricter one would not.
    const isCrossSite = originHeader
      ? !originHost ||
        registrableDomain(originHost) !== registrableDomain(host)
      : false;

    let sameSite = this.configService.getOrThrow<SameSite>(
      'app.session.cookieSameSite',
    );
    let secure = this.configService.getOrThrow<boolean>(
      'app.session.cookieSecure',
    );

    // A browser will not attach a Lax cookie to a cross-site request, so on this
    // request that setting cannot describe a working session — it can only
    // describe a broken one. Correct it rather than honour it.
    if (isCrossSite && sameSite !== 'none') {
      sameSite = 'none';
    }

    // Browsers reject SameSite=None unless the cookie is also Secure.
    if (sameSite === 'none') {
      secure = true;
    }

    return {
      httpOnly: true,
      secure,
      sameSite,
      // A Domain the responding host does not belong to makes the browser drop
      // the cookie outright — the failure that `AUTH_COOKIE_DOMAIN=.pzee.in`
      // causes while the API is still served from onrender.com.
      domain: this.cookieDomainFor(host),
      path: '/',
      maxAge: this.configService.getOrThrow<number>('app.session.maxAgeMs'),
    };
  }

  private cookieDomainFor(host: string): string | undefined {
    const domain = this.configService.get<string>('app.session.cookieDomain');

    if (!domain) return undefined;

    return isWithinCookieDomain(host, domain) ? domain : undefined;
  }
}
