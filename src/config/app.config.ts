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

function parseSameSite(value: string | undefined): SameSite {
  const sameSite = value?.trim().toLowerCase();
  return sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax';
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
    corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
    /** Swagger is opt-in outside development, so the API surface stays private. */
    enableSwagger: isProduction
      ? process.env.ENABLE_SWAGGER === 'true'
      : true,
    session: {
      maxAgeDays: SESSION_MAX_AGE_DAYS,
      maxAgeMs: SESSION_MAX_AGE_DAYS * MILLISECONDS_PER_DAY,
      cookieName: process.env.AUTH_COOKIE_NAME?.trim() || 'pzee_session',
      // The site and the API sit on different subdomains in production, so the
      // cookie needs SameSite=None over HTTPS there.
      cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
      cookieSameSite: parseSameSite(process.env.AUTH_COOKIE_SAME_SITE),
      cookieDomain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    },
  };
});
