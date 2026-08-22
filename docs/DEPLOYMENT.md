# Deploying the Pzee API

Target: **Render**. The API answers on **https://pg-backend-pozw.onrender.com**
today; the website is on `pzee.in` and `www.pzee.in` (Vercel). Moving the API to
`api.pzee.in` is the one outstanding improvement — see section 4.

Railway works the same way — the build and start commands below are identical,
only the config file differs.

## 1. Environment variables

Everything the app needs. Values marked **secret** go in the hosting dashboard,
never in the repository.

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Turns on the production defaults below. |
| `PORT` | *(set by Render)* | The app reads it. Do not hardcode. |
| `HOST` | *(leave unset)* | Defaults to `0.0.0.0`. Setting it to `127.0.0.1` makes the app invisible to the platform. |
| `PUBLIC_BASE_URL` | `https://pg-backend-pozw.onrender.com` | Must be the host the service actually answers on: every URL the API hands out is built from it. |
| `CORS_ORIGINS` | `https://pzee.in,https://www.pzee.in` | Exact browser origins. |
| `AUTH_COOKIE_NAME` | `pzee_session` | |
| `AUTH_COOKIE_SECURE` | **leave unset** | Decided per request — see "The session cookie" below. |
| `AUTH_COOKIE_SAME_SITE` | **leave unset** | Decided per request. |
| `AUTH_COOKIE_DOMAIN` | **leave unset** | Set to `.pzee.in` *only* once the API answers on a `*.pzee.in` host. |
| `ENABLE_SWAGGER` | unset, or `false` | `true` publishes `/api/docs`. |
| `DATABASE_URL` | **secret** | Supabase pooled connection, port 6543. |
| `DIRECT_URL` | **secret** | Supabase direct connection, port 5432. Migrations use this. |
| `JWT_SECRET` | **secret** | Generate a new one; never reuse the development value. |
| `CLOUDINARY_CLOUD_NAME` | **secret** | |
| `CLOUDINARY_API_KEY` | **secret** | |
| `CLOUDINARY_API_SECRET` | **secret** | |

Generate a production JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 2. Build and start

```bash
# Build
npm ci --include=dev && npx prisma migrate deploy && npm run build

# Start
npm run start:prod
```

Two details that will break the build if changed:

- **`--include=dev`** is required. `NODE_ENV=production` makes npm skip
  devDependencies, and the build needs `prisma`, `@nestjs/cli` and
  `typescript`.
- **The Prisma client is generated automatically** by the `postinstall` and
  `prebuild` scripts. `src/generated/prisma/` is gitignored, so a fresh
  checkout has none; without generation every file that imports it fails to
  compile.

`prisma migrate deploy` applies pending migrations and nothing else. It never
resets or drops data, which is why it, and not `migrate dev`, belongs in a
deploy.

Health check path: `/api/health`. `/api/health/database` also proves the
database connection, which is the more useful of the two after a deploy.

## 3. Render service settings

Render's defaults do **not** work for this app. Set both explicitly:

| Setting | Value |
| --- | --- |
| Build Command | `npm ci --include=dev && npx prisma migrate deploy && npm run build` |
| Start Command | `npm run start:prod` |

`npm start` runs `nest start`, which is the development command: it recompiles
from source, needs the dev dependencies at runtime, and is not what should serve
traffic. `start:prod` runs the compiled `dist/main` directly.

If a deploy hangs on **"No open ports detected"**, the app is listening
somewhere Render cannot reach. Check that `HOST` is unset — a stray
`HOST=127.0.0.1` copied from a local `.env` binds loopback only.

## 4. DNS — moving the API onto `api.pzee.in`

Not required, but it is the difference between a session that works in every
browser and one that works only where third-party cookies are allowed. While the
API is on `onrender.com` it is a *different site* from `pzee.in`, so the session
cookie is third-party: Safari, Firefox and Brave block it by default, and Chrome
blocks it in Incognito.

| Record | Name | Points to |
| --- | --- | --- |
| CNAME | `api` | The Render service hostname |

Add `api.pzee.in` as a custom domain on the service so Render issues the
certificate, then:

1. `PUBLIC_BASE_URL=https://api.pzee.in`
2. `AUTH_COOKIE_DOMAIN=.pzee.in` — safe only now, not before
3. `NEXT_PUBLIC_API_BASE_URL=https://api.pzee.in/api` on the website build

The cookie becomes first-party and the app relaxes itself back to `SameSite=Lax`
with no further changes. The cookie is `Secure` whenever it crosses sites, so
**nothing works over plain HTTP** — that is deliberate.

Routing the API through the website instead (a Vercel rewrite) is **not** a
substitute: Vercel caps a proxied request body at 4.5 MB while image uploads are
allowed up to 5 MB, so the largest uploads would fail.

## 5. The website

Set this on the frontend build, or it will keep calling localhost:

```
NEXT_PUBLIC_API_BASE_URL=https://pg-backend-pozw.onrender.com/api
```

## The session cookie

Its attributes are settled **per request**, from that request's own `Host` and
`Origin`, not from configuration read at boot:

- **Cross-site request** (`pzee.in` → `onrender.com`) → `SameSite=None; Secure`,
  because a `Lax` cookie is never sent back and no configuration could make it
  work.
- **Same-site request** (`www.pzee.in` → `api.pzee.in`, or localhost in
  development) → `SameSite=Lax`, the stricter and safer default.
- **`AUTH_COOKIE_DOMAIN`** is applied only when the responding host is inside
  that domain, and ignored otherwise — a mismatched `Domain` makes the browser
  discard the cookie silently.

`AUTH_COOKIE_SAME_SITE` and `AUTH_COOKIE_SECURE` still work, but they cannot
force a combination a browser would reject. This is deliberate: the live API was
once deployed carrying a developer's local `AUTH_COOKIE_SAME_SITE=lax`, and the
only symptom was a dashboard that signed in and immediately reported
"Authentication required".

## What is enforced in production

- **CORS fails closed.** With `NODE_ENV=production` and no `CORS_ORIGINS`, the
  app refuses to start. Reflecting any origin while sending credentials would
  let any site make authenticated requests with a visitor's session cookie.
- **Swagger is off** unless `ENABLE_SWAGGER=true`.
- **Rate limiting**: 10 requests/second and 120/minute across the API, with
  login capped at 10/minute and registration at 5/minute per address.
- **`trust proxy`** is enabled so rate limiting sees the real client address and
  the Secure cookie is set correctly behind Render's TLS termination.
- **Helmet and compression** are applied to every response.
- **Shutdown hooks** let the platform drain connections on deploy.

## Uploads

Cloudinary must be configured in production. Without those three variables the
app falls back to writing files to local disk, and a container's filesystem is
wiped on every deploy — the images would vanish.

## After deploying

```bash
# Should return {"status":"ok", ...}
curl https://api.pzee.in/api/health
curl https://api.pzee.in/api/health/database

# Should be refused: no Access-Control-Allow-Origin header comes back
curl -I -H "Origin: https://evil.example.com" https://api.pzee.in/api/health

# Should be allowed
curl -I -H "Origin: https://www.pzee.in" https://api.pzee.in/api/health
```

Then sign in on the live site and confirm the session survives a refresh. The one
header that decides it:

```bash
curl -s -i -X POST https://pg-backend-pozw.onrender.com/api/v1/auth/login   -H 'Content-Type: application/json' -H 'Origin: https://www.pzee.in'   -d '{"identifier":"owner@pzee.in","password":"..."}' | grep -i set-cookie
```

While the API and the site are on different domains it must come back
`SameSite=None; Secure`. `SameSite=Lax` there means the browser accepts the
cookie at login and then refuses to send it with the next request: login
succeeds, and every call after it answers "Authentication required".

## Seeding

`npm run seed` creates one login per role. It is safe to re-run, but it sets a
**known shared password**. Do not run it against production unless you intend
those accounts to exist, and change the passwords immediately if you do.
