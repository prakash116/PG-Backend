/** Central application configuration: maps environment variables to typed values. */
import { registerAs } from '@nestjs/config';

/** Sessions stay valid for 30 days and are extended on every session check. */
const SESSION_MAX_AGE_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type SameSite = 'lax' | 'strict' | 'none';

/**
 * Browsers compare the Origin header exactly, so `pzee.in` and
 * `https://www.pzee.in/` never match a real origin. Missing schemes are filled
 * in and trailing slashes removed, which is the difference between CORS
 * working and a silent, hard-to-debug rejection in production.
 */
function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => (/^https?:\/\//i.test(origin) ? origin : `https://${origin}`))
    .map((origin) => origin.replace(/\/+$/, ''))
    .filter((origin, index, all) => all.indexOf(origin) === index);
}

function parseSameSite(
  value: string | undefined,
  fallback: SameSite,
): SameSite {
  const sameSite = value?.trim().toLowerCase();

  if (sameSite === 'strict' || sameSite === 'none' || sameSite === 'lax') {
    return sameSite;
  }

  return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() || '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const flag = value?.trim().toLowerCase();

  if (flag === 'true') return true;
  if (flag === 'false') return false;

  return fallback;
}

export default registerAs('app', () => {
  const environment = process.env.NODE_ENV?.trim() || 'development';
  const isProduction = environment === 'production';

  // Bind every interface unless told otherwise. A hosting platform routes to
  // the container's external address, so listening on 127.0.0.1 makes the app
  // invisible — Render reports "No open ports detected" and the deploy hangs.
  // Local development sets HOST=127.0.0.1 in .env to stay off the LAN, which
  // means a missing NODE_ENV can never strand a deploy.
  //
  // `??` is wrong here: a variable left blank in a .env file or a hosting
  // dashboard arrives as an empty string, which `??` would keep.
  const host = process.env.HOST?.trim() || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT?.trim() || '3000', 10);

  const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);

  return {
    environment,
    isProduction,
    host,
    port,
    // Absolute base for URLs this API hands out, such as uploaded images.
    // `??` is deliberately avoided here: a variable left blank in a .env file
    // arrives as an empty string rather than undefined, and `??` would keep it,
    // producing relative image URLs the website could not load.
    publicUrl: (
      process.env.PUBLIC_BASE_URL?.trim() || `http://${host}:${port}`
    ).replace(/\/+$/, ''),
    corsOrigins,
    /** Swagger is opt-in outside development, so the API surface stays private. */
    enableSwagger: isProduction
      ? process.env.ENABLE_SWAGGER === 'true'
      : true,
    session: sessionConfig(isProduction, corsOrigins),
    database: databaseConfig(),
    listing: listingConfig(),
  };
});

/**
 * The one-off fee that makes a PG listing public, and the referral reward paid
 * out of it.
 *
 * Both are rupees, matching every other amount in this project. They are
 * configurable because a price is a business decision, not a constant — but
 * they default to the agreed ₹100 so nothing breaks when the variables are
 * absent.
 */
function listingConfig() {
  return {
    feeRupees: parseInteger(process.env.LISTING_FEE_RUPEES, 100),
    referralRewardRupees: parseInteger(
      process.env.REFERRAL_REWARD_RUPEES,
      100,
    ),
    /**
     * Where owners send the fee. Empty until it is set, and the API says so
     * rather than showing a placeholder someone might actually pay.
     */
    payeeUpiId: process.env.SUPER_ADMIN_UPI_ID?.trim() || '',
  };
}

/**
 * Connection pool settings for the Supabase pooler.
 *
 * These are not arbitrary. Opening a connection to the pooler was measured from
 * this project at 2.2s–12.9s, while reusing an already-open one answers in under
 * a second — the database is in ap-southeast-2 and the TLS and pooler handshake
 * dominate. Two defaults therefore have to be overridden:
 *
 * - node-postgres times a connection attempt out after 5s here, which is below
 *   what the handshake routinely costs, so the attempt was being abandoned
 *   moments before it would have succeeded.
 * - node-postgres discards an idle connection after 10s. Anyone reading a page
 *   for longer than that paid the full cold handshake on their next click, so
 *   nearly every request was a cold one.
 */
function databaseConfig() {
  return {
    poolMax: parseInteger(process.env.DB_POOL_MAX, 5),
    // Generous, because a slow answer beats a failed one. It is a ceiling, not
    // a delay: a healthy connection still completes in seconds.
    connectionTimeoutMs: parseInteger(
      process.env.DB_CONNECTION_TIMEOUT_MS,
      30_000,
    ),
    // Keep a connection through the pauses in ordinary use, so the handshake is
    // paid once per session rather than once per click.
    idleTimeoutMs: parseInteger(process.env.DB_IDLE_TIMEOUT_MS, 600_000),
  };
}

/**
 * A session cookie only reaches the API if its attributes match how the site is
 * actually served. A browser will not send a `SameSite=Lax` cookie on a request
 * from `pzee.in` to an API on another domain, so the deployed dashboard would
 * sign in and immediately report "Authentication required".
 *
 * The right attributes are therefore derived rather than left to be remembered:
 * an https origin in `CORS_ORIGINS` means real browsers are talking to this API
 * cross-site over TLS, which is exactly when `SameSite=None; Secure` is needed.
 * Local development keeps `Lax` and no `Secure`, because there is no https
 * origin configured. Either value can still be set explicitly.
 */
function sessionConfig(isProduction: boolean, corsOrigins: string[]) {
  const servesHttpsSite = corsOrigins.some((origin) =>
    origin.startsWith('https://'),
  );
  const isCrossSite = isProduction || servesHttpsSite;

  const sameSite = parseSameSite(
    process.env.AUTH_COOKIE_SAME_SITE,
    isCrossSite ? 'none' : 'lax',
  );

  return {
    maxAgeDays: SESSION_MAX_AGE_DAYS,
    maxAgeMs: SESSION_MAX_AGE_DAYS * MILLISECONDS_PER_DAY,
    cookieName: process.env.AUTH_COOKIE_NAME?.trim() || 'pzee_session',
    // Browsers reject `SameSite=None` unless the cookie is also `Secure`, so
    // that combination is never allowed to be configured into existence.
    cookieSecure:
      sameSite === 'none' ||
      parseBoolean(process.env.AUTH_COOKIE_SECURE, isCrossSite),
    cookieSameSite: sameSite,
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
  };
}
