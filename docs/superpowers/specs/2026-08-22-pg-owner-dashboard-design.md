# PG owner dashboard — model, owner API, dashboard (sub-projects A + B)

Date: 2026-08-22
Scope: `PG-Backend` (NestJS + Prisma) and `PG-Website` (Next.js)

## Goal

Give a PG owner one place to complete and maintain their listing: property
basics, room inventory with availability, amenities, food, and photos. The PG
itself already exists — registration creates it with a name, a location and a
unique `pgCode`.

## Context that shaped this

`PG-Website/lib/types.ts` already defines the `PG` domain model, and
`components/pg/PGListing.tsx` already filters on budget, gender, AC/non-AC,
amenities and verified-only against 13 mock records. This work makes that model
real rather than inventing a new one, so the public pages can later swap from
mock data to the API without reshaping anything.

## Decisions

1. **One PG per owner.** `Pg.ownerId` stays unique. No property switcher.
2. **One row per room type**, not per physical room — the shape
   `lib/types.ts` already expects.
3. **Dashboard with a completion meter and independent section editors**, so an
   owner can fill things in any order and save partial progress.
4. **Owner photos reuse the existing Cloudinary pipeline**, generalised to take
   a folder.
5. **`verification` ships as a field only.** The approval workflow is a later
   sub-project; owners can never set it themselves.
6. **`rating` / `reviewCount` ship as read-only zero aggregates**, filled in by
   the later ratings sub-project.

Out of scope: the public listing/detail API, swapping the website off mock
data, the super-admin approval workflow, and user-submitted ratings.

## Data model

```prisma
enum PgGender           { BOYS GIRLS CO_LIVING }
enum Cooling            { AC NON_AC BOTH }
enum RoomType           { SINGLE DOUBLE TRIPLE PREMIUM }
enum VerificationStatus { PENDING VERIFIED REJECTED }
```

`Pg` gains: `city`, `description`, `price`, `deposit`, `gender`, `cooling`,
`foodIncluded`, `foodDetails`, `amenities String[]`, `images String[]`,
`verification`, `rating`, `reviewCount`, and a `roomTypes` relation. Every new
column is optional or defaulted, so existing rows stay valid.

```prisma
model PgRoomType {
  id            String   @id @default(cuid())
  pgId          String
  pg            Pg       @relation(fields: [pgId], references: [id], onDelete: Cascade)
  type          RoomType
  roomCount     Int      @default(0)
  pricePerBed   Int
  totalBeds     Int      @default(0)
  availableBeds Int      @default(0)
  @@unique([pgId, type])
}
```

`amenities` is a string array rather than a join table because the frontend
already models it that way, and Postgres can filter it with `has` / `hasEvery`.

### Beds

`totalBeds` is derived from `roomCount`, so the owner answers only "how many
double rooms?":

| Type | Beds per room |
| --- | --- |
| SINGLE | 1 |
| DOUBLE | 2 |
| TRIPLE | 3 |
| PREMIUM | 1 |

`availableBeds` must be between `0` and `totalBeds`; the API rejects anything
else. A PG is available when the sum of `availableBeds` across its room types is
greater than zero.

## API

All routes require a session cookie and the `PG_OWNER` role, via the existing
`JwtAuthGuard` + `RolesGuard`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/pg/me` | The owner's PG with its room types |
| PATCH | `/api/v1/pg/me` | Basics, amenities, food, photos |
| PUT | `/api/v1/pg/me/rooms` | Replace the room-type set |
| PATCH | `/api/v1/pg/me/rooms/:type` | Availability for one type |
| POST | `/api/v1/uploads/pg-image` | Upload one PG photo |

The owner is resolved from the session, never from a client-supplied id.
Accepting an id in the path would let any owner read or edit another owner's PG
by changing it.

`verification`, `rating`, `reviewCount`, `pgCode` and `ownerId` are absent from
every write DTO. With the global `ValidationPipe` running `whitelist: true`,
those keys are stripped from the request body, so an owner cannot self-verify or
fabricate a rating.

`PUT /rooms` replaces the whole set inside a transaction: types absent from the
payload are deleted, so removing a room type is expressible.

### Completion

The API returns a `completion` block — a percentage plus the list of missing
field names — computed from: `description`, `price`, `deposit`, `gender`,
`cooling`, at least one amenity, at least one image, at least one room type.
Computing it server-side keeps the dashboard and any later "ready to publish"
check from disagreeing.

## Dashboard

`/pg-owner/dashboard` replaces the placeholder:

- **Header** — PG name, `pgCode` with copy-to-clipboard, verification badge.
- **Stats** — total rooms, available beds, occupancy, rating (reads "No ratings
  yet" until the ratings sub-project lands).
- **Completion meter** — percentage and the next missing item, from the API.
- **Section editors** — Basics, Rooms & pricing, Amenities & food, Photos. Each
  saves on its own so partial progress is never lost.

The page is a client component behind the existing `RoleGate role="PG_OWNER"`,
so it works unchanged under the site's static export.

## Error handling

- No PG for the signed-in owner → `404` with a message pointing at registration.
  This is reachable today: `restocare4@gmail.com` was created before the `Pg`
  table existed, so the dashboard must handle an owner without a PG.
- `availableBeds` above `totalBeds`, or a negative count → `400`.
- A duplicate room type in one `PUT /rooms` payload → `400`.
- Upload failures surface as the existing `400` / `413` responses.

## Verification

1. `npx prisma generate`, clean `tsc --noEmit`, and `npm run build` in both projects.
2. The Nest application context resolves (catches DI wiring, which a build cannot).
3. `GET /pg/me` as an owner returns the PG; as a finder returns `403`; signed out
   returns `401`.
4. `PATCH /pg/me` with `verification: "VERIFIED"` in the body leaves the stored
   value `PENDING` — proving the field is stripped.
5. `PUT /rooms` writes counts, derives `totalBeds`, and rejects
   `availableBeds > totalBeds`.
6. An owner with no PG row gets `404`, not a crash.
7. Existing endpoints — login, `/me`, register, health — still pass.
