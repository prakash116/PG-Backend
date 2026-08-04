# PG Backend

NestJS backend organized as feature-based MVC modules.

## Run locally

```bash
npm install
npm run start:dev
```

After startup, the terminal displays the `PZEE` banner in Indian Saffron
(`#FF9933`) and shows the local API URL.

By default, the backend runs locally at `http://127.0.0.1:3000`. Change `HOST`
or `PORT` in `.env` when a different local address is needed.

Available starter endpoints:

- `GET /api/example` demonstrates the controller, service, and model flow.
- `GET /api/health` reports whether the application is running.

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
