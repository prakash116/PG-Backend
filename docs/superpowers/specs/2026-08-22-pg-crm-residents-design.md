# PG owner CRM — residents and payments

Date: 2026-08-22
Scope: `PG-Backend` (NestJS + Prisma) and `PG-Website` (Next.js)

## Goal

Let an owner record who is staying in their PG, what each guest owes, and what
has been collected. Bed availability stops being typed in and becomes a
consequence of who is actually staying.

## Decisions

1. **A guest is matched to their Pzee account when one exists**, by phone or
   email. Walk-ins with no account are stored the same way, with no link.
2. **Payments are individual records**, not two dates on the guest. Only a
   per-transaction row can answer "collected this month" or "collected today".
3. **Free beds = total beds − active guests.** The stored `availableBeds`
   column is removed, along with the field that let an owner type it in.

## Data model

```prisma
enum ResidentStatus { ACTIVE LEFT }
enum Occupation     { STUDENT EMPLOYEE OTHER }

model Resident {
  id          String         @id @default(cuid())
  pgId        String
  /// Linked Pzee account when the guest is registered; null for a walk-in.
  userId      String?
  fullName    String
  phone       String
  address     String?
  gender      Gender?
  occupation  Occupation?
  /// Which sharing type they occupy. Room numbers are a later feature.
  roomType    RoomType
  monthlyRent Int
  joinedAt    DateTime       @default(now())
  dueDate     DateTime?
  leftAt      DateTime?
  status      ResidentStatus @default(ACTIVE)
  payments    Payment[]
  @@index([pgId, status])
}

model Payment {
  id         String   @id @default(cuid())
  residentId String
  /// Denormalised so a PG's collections can be summed without a join.
  pgId       String
  amount     Int
  paidOn     DateTime @default(now())
  /// The rent month this covers, stored as the first of that month.
  forMonth   DateTime?
  note       String?
  @@index([pgId, paidOn])
}
```

`Gender` and `RoomType` are the enums that already exist, so the CRM and the
listing describe a guest the same way.

The guest's "payment date" is the most recent `Payment.paidOn`, derived rather
than stored, so it can never disagree with the payment history.

## Availability

`PgRoomType.availableBeds` is dropped. The API computes, per room type:

```
availableBeds = totalBeds − count(residents WHERE status = ACTIVE AND roomType = type)
```

Consequences, all deliberate:

- `RoomTypeInput.availableBeds` is removed from `PUT /v1/pg/me/rooms`.
- `PATCH /v1/pg/me/rooms/:type` is deleted — there is nothing left to set.
- The "Free beds" input disappears from Room management.
- Adding a guest to a full room type is rejected with `400`.
- Existing manual numbers are lost. With no guests recorded, every bed reads as
  free, which is what the data actually says.

## API

All owner routes require a session cookie and the `PG_OWNER` role.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/pg/me/residents` | Guest list; `status` and `search` filters |
| POST | `/api/v1/pg/me/residents` | Add a guest; links a Pzee account if found |
| PATCH | `/api/v1/pg/me/residents/:id` | Edit a guest |
| POST | `/api/v1/pg/me/residents/:id/checkout` | Mark as left; frees the bed |
| DELETE | `/api/v1/pg/me/residents/:id` | Remove a mistaken entry |
| POST | `/api/v1/pg/me/residents/:id/payments` | Record a payment |
| GET | `/api/v1/pg/me/crm/summary` | Totals, with `from`/`to` for day or month |

Every route resolves the PG from the session and checks the resident belongs to
it before touching anything. A resident id from another PG returns `404`, so one
owner can never read or edit another owner's guests.

### Summary

```
totalGuests    active residents
pendingAmount  Σ over active guests of (rent owed − paid)
collected      Σ payments in the period
```

`pendingAmount` counts whole months elapsed since `joinedAt` against payments
recorded, so it reflects arrears rather than a single cycle.

## Frontend

- `lib/api/crm.ts` — types and calls.
- `stores/crm-store.ts` — list, summary, and the day/month filter.
- `/pg-owner/crm` — stat tiles (guests, pending, collected), a period filter, a
  guest table, and dialogs to add or edit a guest and record a payment.
- Room management loses its "Free beds" input and shows the derived figure.
- The Overview bed tile keeps working, now reading the derived number.

## Error handling

- Adding a guest to a room type with no free bed → `400` naming the type.
- A room type the PG does not offer → `400`.
- A resident id belonging to another PG → `404`.
- Payment amount below 1, or a future `paidOn` → `400`.
- Checking out an already-left guest → `400`.

## Verification

1. Both projects typecheck, lint and build; the Nest context resolves.
2. Adding a guest reduces that room type's free beds by one.
3. Checking a guest out returns the bed.
4. Filling a room type then adding one more guest → `400`.
5. A guest whose phone matches a registered `USER` is linked; a walk-in is not.
6. Payments sum into `collected`; the period filter narrows them.
7. A resident id from another PG returns `404`.
8. Existing endpoints — login, `/me`, PG read and update — still pass.
