# Backend Starter

This project now has a minimal backend layer for the lab workflow domain.

## Current shape

- Entry point: `server.mjs`
- New backend routes: `backend/routes/lab-api.mjs`
- Service layer: `backend/services/lab-service.mjs`
- Repository layer: `backend/repositories/lab-repository.mjs`
- File repository: `backend/repositories/file-lab-repository.mjs`
- Prisma repository: `backend/repositories/prisma-lab-repository.mjs`
- File-based persistence: `backend/data/store.mjs`
- Seed data source: `backend/data/seed.mjs`
- Request validation: `backend/lib/validation.mjs`
- Prisma config: `prisma.config.ts`
- Prisma schema: `prisma/schema.prisma`

The backend can now switch persistence drivers with `LAB_REPOSITORY_DRIVER`:

- `file`: JSON file store at `backend/data/lab-data.json`
- `prisma`: PostgreSQL via Prisma, with automatic first-run seed data

The file store is still the default. This keeps the live app simple while the database path is introduced behind the same repository contract:

- route handling
- input validation
- service-level business rules
- repository abstraction
- persistence
- domain consistency between projects, tasks, documents, and schedules

## Available endpoints

- `GET /api/health`
- `GET /api/lab/bootstrap`
- `GET /api/users`
- `PATCH /api/users/:userId/role`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/projects/:projectId/documents`
- `POST /api/projects/:projectId/documents`
- `PATCH /api/documents/:documentId`
- `DELETE /api/documents/:documentId`
- `GET /api/projects/:projectId/schedules`
- `POST /api/projects/:projectId/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules/:scheduleId`
- `DELETE /api/schedules/:scheduleId`
- `POST /api/timetable-blocks`
- `POST /api/assistant/chat`

## Why this step matters

The frontend now bootstraps its core lab data from `/api/lab/bootstrap` and writes create/update/delete actions back to the backend with optimistic local updates.

That means the app has started the transition from mock-only state to API-backed state, while still keeping the UI responsive.

Prisma is no longer just scaffolded. The repository layer now has both file and Prisma implementations behind the same interface, so the app can switch drivers without changing frontend contracts.

## Using the Prisma driver

1. Start PostgreSQL and set `DATABASE_URL` in `.env`.
2. Run `npm run prisma:generate`.
3. Run `npm run prisma:db:push` to apply the current schema.
4. Set `LAB_REPOSITORY_DRIVER=prisma`.
5. Start the server with `npm run dev` or `npm run dev:server`.

If PostgreSQL is not reachable, the API now returns `503 Database connection failed` instead of a generic `500`.

The next iterations can now be done in a controlled order:

1. Replace the remaining local-only mutations with backend endpoints where needed.
2. Add authentication and current-user handling.
3. Add Prisma migrations and move from fallback seeding to explicit database setup.
4. Move validation and domain rules into dedicated services as the app grows.
5. Add tests for route validation and cross-entity consistency.

## Recommended next milestone

The best next practical step after this commit is:

1. split route logic into service and repository modules
2. introduce PostgreSQL and Prisma
3. add real authentication and project-level authorization

Once that works, the current file-backed implementation can be replaced without changing the frontend contracts again.
