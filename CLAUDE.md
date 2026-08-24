# PG Backend — working rules

NestJS + Prisma 7 (`prisma-client` generator) + Postgres/Supabase.

## Rule 1: regenerate the Prisma client before trusting a build

`src/generated/prisma/` is **gitignored** — it is a per-machine build artifact, not
source. It goes stale silently: the schema in Git moves ahead, the local generated
client does not, and every model/enum import fails at once.

Run `npx prisma generate` **before** typechecking, building, or debugging whenever:

- `prisma/schema.prisma` changed (models, enums, fields),
- you pulled/merged, switched branches, or cloned fresh,
- `npm install` was run.

Generation is wired to `postinstall` and `prebuild` in package.json, so a
fresh checkout — a CI runner or a hosting platform — always builds a client.
Do not remove those scripts: `src/generated/prisma/` is gitignored, so without
them every file that imports it fails to compile, which is exactly how a Render
deploy failed with forty errors that all traced back to one missing module.

Symptoms that mean "stale client, not broken code" — regenerate first, do **not**
edit source to work around them:

- `Property '<model>' does not exist on type 'DatabaseService'`
- `Module '.../generated/prisma/client' has no exported member '<Enum>'`
- `src/generated/prisma/enums.ts` says *"This file is empty because there are no enums in the schema"* while the schema clearly has enums
- `src/generated/prisma/models/` is empty

`DatabaseService` extends `PrismaClient`, so every model delegate (`this.user`, …)
comes from the generated client. Missing delegates are a generation problem.

## Rule 2: keep `.env` in sync with `.env.example`

`.env` is gitignored and drifts. `.env.example` is the tracked contract.

When adding a config value read with `configService.getOrThrow(...)`:

1. add it to `.env.example` with a safe placeholder **and** a comment saying what it does,
2. add it to your local `.env`,
3. state in the PR/commit that a new env var is required.

After pulling, diff the two before debugging a boot failure:

```bash
diff <(grep -oE '^[A-Z_]+' .env.example | sort -u) <(grep -oE '^[A-Z_]+' .env | sort -u)
```

`TypeError: Configuration key "X" does not exist` at boot means `X` is missing from
`.env` — add the variable, never delete or soften the `getOrThrow`.

Note: `getOrThrow` rejects only `undefined`, so `false` and `0` are valid values.

### ...and never paste `.env` into a hosting dashboard

`.env` describes **this machine**: `HOST=127.0.0.1`, `AUTH_COOKIE_SECURE=false`,
`AUTH_COOKIE_SAME_SITE=lax`. Every one of those is wrong in production, and none
of them fails loudly — the app boots, login returns 200, and the next request is
a 401. Copy variables into a hosting dashboard one at a time, from
`docs/DEPLOYMENT.md`, never wholesale.

Config that can only ever be wrong should not be obeyed. Where the request
itself knows better — as with the session cookie, which reads its own `Host` and
`Origin` — derive the value and let the environment override only what it could
plausibly get right.

## Rule 3: the human runs the servers, not the agent

**The developer starts and stops the backend and the website themselves.** Do not
run `npm start`, `npm run start:dev`, `npm run dev`, `next dev`, `node dist/main`,
`prisma studio`, or anything else that holds a port.

- Never kill a process or free a port you did not start. Ports 3000 (website) and
  5000 (API) normally belong to the developer's own terminals.
- If a runtime check is genuinely needed, **ask** — say which command you want run
  and what output you need back. Do not start it "just to check".
- If you are ever explicitly told to start something, stop it in the same turn,
  and confirm the port is free afterwards.
- Before stopping anything you were asked to stop, check `CommandLine` and
  `CreationDate` (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).
  A process started seconds ago is the developer's, not a leftover.

## Rule 4: verify before claiming it works

Evidence, not assumption. These are safe to run yourself — they all exit on their
own and hold no port:

```bash
npx prisma generate
npx tsc --noEmit -p tsconfig.json   # must be clean
npm run build                       # must succeed
```

A clean typecheck does **not** prove the app boots — config and dependency-injection
errors (Rule 2) surface only at runtime. So do not claim "it works" or "it runs" off
a green build. Say exactly what was checked ("typecheck and build pass; not booted"),
and ask the developer to start it and report `/api/health` and
`/api/health/database` when boot confirmation matters.

`PORT` comes from `.env` (currently 5000), not the `3000` in the README.

### `npm start` is the production command

`npm start` runs `node dist/main`. Do not change it back to `nest start`.

A hosting platform with no start command configured falls back to `npm start`,
so whatever that script does is what production does. `nest start` recompiles
TypeScript in memory at boot, which took a 512 MB Render instance past its heap
limit before it bound a port — twice, months apart, because a dashboard setting
can be cleared and nothing in the repository contradicted it. The default is now
the safe one.

Use `npm run start:dev` for local work; it watches and recompiles. `npm start`
now needs `npm run build` first.

Related Windows trap, for whoever is running it: a live `node dist/main` holds
handles on `dist/`, so rebuilding over a running server leaves files in a
pending-delete state and the next boot fails with a misleading
`Cannot find module './config/app.config'`. That is a stale-process artifact, not a
code bug — stop the server, rebuild, and it goes away.

## Rule 5: fix the root cause, don't route around it

Never "fix" a build by editing generated files, loosening `tsconfig` `strict`,
adding `any`, or `@ts-ignore`-ing an import. Those hide Rule 1 and Rule 2 problems
and break the next person. Regenerate or fix config instead.

## Rule 6: keep existing functions working — don't break what already works

A fix that breaks something else is not a fix. Every change has to leave the
behaviour around it intact, and you have to *show* that, not assume it.

- **Add, don't replace.** Extend an allow-list, add a branch, add an optional
  field. Rewriting a working function to make room for a new case is how the
  new case ships and the old one quietly stops working.
- **Before changing a shared type, DTO or response shape, find every caller.**
  `grep` the name across both projects. A field added to a DTO but not to the
  website's matching interface — or the reverse — compiles cleanly on both
  sides and fails at runtime.
- **When you fix a bug, assert the neighbours still hold.** The test for
  "roomCount is now sent" is worth little without "501 rooms is still refused"
  and "a missing photo is still named" beside it.
- **Never widen validation to make an error go away.** If a payload is
  rejected, fix the payload. Raising a `@Max`, dropping a `@IsNotEmpty` or
  loosening a regex to silence a message removes a guard that was doing its job.
- **Decorator order is load-bearing.** class-validator reports a field's failed
  constraints in *reverse declaration order*, and the website shows the first
  message. Declare the type check (`@IsInt`, `@IsString`) **last** so a missing
  value reads as "this is required" rather than as a complaint about a limit —
  a missing `roomCount` was once reported as "must not be greater than 500",
  which sent the search to the wrong side of the request entirely.

If you cannot keep an existing behaviour, say so explicitly and explain the
trade-off. Do not decide silently.

## Roles

Three roles live in the `UserRole` enum: `SUPER_ADMIN`, `PG_OWNER`, `USER`.

- Server-side enforcement is `@Roles(...)` + `RolesGuard`, and **`JwtAuthGuard`
  must be listed first** in `@UseGuards` — it populates the `sessionUser` that
  `RolesGuard` reads. A route with no `@Roles` allows any authenticated user.
- `RolesGuard` fails closed: no `sessionUser` means 403, never an accidental allow.
- Registration cannot create a `SUPER_ADMIN` (`auth.service.ts` rejects it).
  Admins come from the seed or a deliberate promotion.
- The website mirrors this in `lib/auth/roles.ts` (`getRoleDestination`) and
  `components/auth/RoleGate.tsx`. Change both sides together.

`npm run seed` creates one known login per role and is safe to re-run — every
write is an upsert keyed on email, and an existing PG never has its `pgCode`
regenerated, because that code is an identity people share.

## Conventions

- Feature-based MVC under `src/modules/<feature>/{controllers,services,models}` plus `<feature>.module.ts`.
- URL prefixes are declared in `src/routes/app.routes.ts`, not hardcoded in controllers.
- Environment access goes through `src/config/app.config.ts` (`registerAs('app', …)`), not raw `process.env` in feature code.
- Never commit `.env`, real secrets, or `src/generated/`.
