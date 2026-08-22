# Deploying the Pzee API

Target: **Render**, served from **https://api.pzee.in**, with the website on
`pzee.in` and `www.pzee.in`.

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
| `PUBLIC_BASE_URL` | `https://api.pzee.in` | Used for any URL the API hands out. |
| `CORS_ORIGINS` | `https://pzee.in,https://www.pzee.in` | Exact browser origins. |
| `AUTH_COOKIE_NAME` | `pzee_session` | |
| `AUTH_COOKIE_SECURE` | `true` | Required for a cross-site cookie. |
| `AUTH_COOKIE_SAME_SITE` | `none` | The site and API are different subdomains. |
| `AUTH_COOKIE_DOMAIN` | `.pzee.in` | Lets `www.pzee.in` send a cookie set by `api.pzee.in`. |
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

## 4. DNS

| Record | Name | Points to |
| --- | --- | --- |
| CNAME | `api` | The Render service hostname |

Add `api.pzee.in` as a custom domain on the service so Render issues the
certificate. The session cookie is `Secure`, so **nothing works over plain
HTTP** — that is deliberate.

## 5. The website

Set this on the frontend build, or it will keep calling localhost:

```
NEXT_PUBLIC_API_BASE_URL=https://api.pzee.in/api
```

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

Then sign in on the live site and confirm the session survives a refresh. If it
does not, the cookie settings are the first place to look: all four
`AUTH_COOKIE_*` values have to match the table above.

## Seeding

`npm run seed` creates one login per role. It is safe to re-run, but it sets a
**known shared password**. Do not run it against production unless you intend
those accounts to exist, and change the passwords immediately if you do.
