/** Central application configuration: maps environment variables to typed values. */
import { registerAs } from '@nestjs/config';

/** Sessions stay valid for 30 days and are extended on every session check. */
const SESSION_MAX_AGE_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type SameSite = 'lax' | 'strict' | 'none';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseSameSite(value: string | undefined): SameSite {
  const sameSite = value?.trim().toLowerCase();
  return sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax';
}

export default registerAs('app', () => ({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  // Empty means "reflect the requesting origin", which keeps local development
  // working while allowing an explicit allowlist in deployed environments.
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  session: {
    maxAgeDays: SESSION_MAX_AGE_DAYS,
    maxAgeMs: SESSION_MAX_AGE_DAYS * MILLISECONDS_PER_DAY,
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'pzee_session',
    // The site and the API are served from different origins in production, so
    // the cookie needs SameSite=None over HTTPS there.
    cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
    cookieSameSite: parseSameSite(process.env.AUTH_COOKIE_SAME_SITE),
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
  },
}));
