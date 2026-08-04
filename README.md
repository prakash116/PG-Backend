# PG Backend

NestJS backend organized as feature-based MVC modules.

## Run locally

```bash
npm install
npm run start:dev
```

The starter health endpoint is available at `GET /api/health`.

## Structure

```text
src/
|-- main.ts                    # Starts and configures the HTTP application
|-- app.module.ts              # Composes global and feature modules
|-- config/                    # Reads and normalizes environment configuration
|-- common/                    # Reusable cross-feature framework concerns
|-- routes/                    # Maps URL prefixes to feature modules
`-- modules/                   # Independently organized business features
    `-- health/
        |-- controllers/       # HTTP routing (Controller)
        |-- models/            # Domain/response shapes (Model)
        |-- services/          # Business rules (service layer)
        `-- health.module.ts    # Feature dependency wiring
```
