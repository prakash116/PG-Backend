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

Related Windows trap, for whoever is running it: a live `node dist/main` holds
handles on `dist/`, so rebuilding over a running server leaves files in a
pending-delete state and the next boot fails with a misleading
`Cannot find module './config/app.config'`. That is a stale-process artifact, not a
code bug — stop the server, rebuild, and it goes away.

## Rule 5: fix the root cause, don't route around it

Never "fix" a build by editing generated files, loosening `tsconfig` `strict`,
adding `any`, or `@ts-ignore`-ing an import. Those hide Rule 1 and Rule 2 problems
and break the next person. Regenerate or fix config instead.

## Conventions

- Feature-based MVC under `src/modules/<feature>/{controllers,services,models}` plus `<feature>.module.ts`.
- URL prefixes are declared in `src/routes/app.routes.ts`, not hardcoded in controllers.
- Environment access goes through `src/config/app.config.ts` (`registerAs('app', …)`), not raw `process.env` in feature code.
- Never commit `.env`, real secrets, or `src/generated/`.
