# Unified registration (Find PG / List PG) — design

Date: 2026-08-21
Scope: `PG-Backend` (NestJS + Prisma) and `PG-Website` (Next.js)

## Goal

One registration API serving both audiences, with the role chosen by a toggle
that defaults to "Find a PG". Owners additionally get a PG record carrying a
unique, shareable PG ID.

| Field | Seeker (`USER`) | Owner (`PG_OWNER`) |
| --- | --- | --- |
| `fullName` | required | required (owner name) |
| `email` | required | required |
| `phone` | required | required |
| `password` | required | required |
| `role` | required | required |
| `address` | required | not collected |
| `dateOfBirth` | required | not collected |
| `pgName` | not collected | required (PG house name) |
| `pgLocation` | not collected | required |
| `profileImage` | optional | optional |
| `userType`, `gender` | optional | not collected |

## Decisions

Settled during brainstorming:

1. Profile photo goes through a **separate upload endpoint** that returns a URL;
   register stays pure JSON.
2. The PG gets a **human-readable unique code** (`PZ-4F7K2A`) and the PG row is
   created **in the same transaction** as the owner.
3. `country`, `state`, `city`, `address`, `pincode` become **nullable**;
   existing rows keep their values.
4. PG house name and location live on the **`Pg` model**; owners store only
   name/email/phone/password/photo on `User`.
5. Register **issues the session cookie**, so a new account lands signed in.
6. A single **`fullName`** input is split into the existing
   `firstName`/`lastName` columns on save.
7. `userType` and `gender` remain **optional seeker fields**.

Assumption flagged to the user: DOB is **required for seekers**, since only the
photo was described as optional.

## Data model

```prisma
model Pg {
  id        String   @id @default(cuid())
  pgCode    String   @unique
  name      String
  location  String
  ownerId   String   @unique
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

`User` changes: `country`, `state`, `city`, `address`, `pincode` become
optional, and a `pg Pg?` back-relation is added. The migration is
`DROP NOT NULL` on five columns plus a `CREATE TABLE` — no data is rewritten.

`ownerId` is `@unique`, giving one PG per owner at registration. Additional
properties per owner are a later feature and are deliberately out of scope.

### PG code

Six characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (digits `0`/`1` and
letters `O`/`I` removed so the code survives being read aloud or handwritten),
prefixed `PZ-`, drawn from `crypto.randomBytes`. On a `P2002` collision the
insert is retried; after a small number of attempts the request fails rather
than looping.

## Register flow

`POST /api/v1/auth/register` — same URL and method as today.

1. Reject `SUPER_ADMIN` (existing behaviour, unchanged).
2. Reject duplicate email or phone with `409` (existing behaviour, unchanged).
3. Hash the password with bcrypt, 10 rounds (existing behaviour, unchanged).
4. Split `fullName` on the first space into `firstName` / `lastName`.
5. In a single `$transaction`: create the `User`; if the role is `PG_OWNER`,
   create the `Pg` linked to it. Both succeed or neither does.
6. Return the created user, plus a `pg` block for owners.
7. The controller writes the session cookie using the existing
   `SessionCookieService`, exactly as login does.

### Validation

One `RegisterDto` with `@ValidateIf` keyed on `role`, so a single endpoint and a
single Swagger schema describe both shapes. This works with the existing global
`ValidationPipe` (`whitelist: true`, `transform: true`) with no pipe changes.

Rejected alternatives: two DTOs behind a custom pipe (needs a new pipe, splits
the Swagger schema); a nested discriminated union (changes the payload shape
more than the feature requires).

## Upload endpoint

`POST /api/v1/uploads/profile-image`, `multipart/form-data`, field `file`.

- Memory storage, 5 MB limit, `image/jpeg`, `image/png`, `image/webp` only.
- Returns `{ success, message, data: { url } }`.
- Backed by a `StorageService` with two drivers: local disk (default) and
  Cloudinary (used automatically when `CLOUDINARY_*` env vars are set).

Local disk is the default so the feature is verifiable without external
accounts. It is **not** suitable for production deploys with ephemeral
filesystems — set the Cloudinary variables before shipping.

## Frontend

- `lib/api/auth.ts` — role-discriminated `RegisterPayload`, `pg` on the
  registered user, and `uploadProfileImage()`.
- `components/forms/RegisterForm.tsx` — the existing role toggle now switches
  the field set; single full-name input; photo picker with preview; the success
  screen shows the owner their PG ID.
- `stores/auth-store.ts` — register marks the user authenticated, since the
  cookie is now issued on register.

## Non-breaking guarantees

Unchanged: login, `/me`, logout, the session cookie contract, bcrypt hashing,
the health endpoints, and every existing DB row.

Two deliberate, coordinated changes:

- The register **request** shape changes (this is the requested feature). Its
  only consumer is `PG-Website`, updated in the same change.
- `users-list-response.model.ts` widens `state` and `city` to `string | null`
  to match the now-nullable columns. Runtime behaviour is unchanged, because
  existing rows still hold values; without this the build would fail.

## Verification

1. `npx prisma generate` and a clean `npx tsc --noEmit` in both projects.
2. `npm run build` in both projects.
3. Boot the API; confirm it reaches "Nest application successfully started".
4. `POST /register` as a seeker → 201, cookie set, row created.
5. `POST /register` as an owner → 201, cookie set, `pg.pgCode` returned.
6. Re-post the same email → 409 (duplicate handling still works).
7. Post an owner payload missing `pgName` → 400, and confirm no orphan user row
   was created (proves the transaction).
8. Upload an image → 200 with a URL; upload a non-image → 400.
9. `GET /login`, `/me`, `/v1/users`, `/health/database` still succeed.
