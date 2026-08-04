# Feature modules

Each business feature belongs in its own directory and follows the same MVC layout:

- `controllers/` handles HTTP input and output.
- `models/` defines domain and response data shapes.
- `services/` holds business logic and coordinates data access.
- `<feature>.module.ts` wires the feature's NestJS providers together.
