# Backend Starter

This project now has a minimal backend layer for the lab workflow domain.

## Current shape

- Entry point: `server.mjs`
- New backend routes: `backend/routes/lab-api.mjs`
- Service layer: `backend/services/lab-service.mjs`
- Repository layer: `backend/repositories/lab-repository.mjs`
- File-based persistence: `backend/data/store.mjs`
- Seed data source: `backend/data/seed.mjs`
- Request validation: `backend/lib/validation.mjs`

The backend uses a JSON file store (`backend/data/lab-data.json`) that is created automatically on first request. This keeps the first backend iteration simple while still introducing the right separation:

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

The next iterations can now be done in a controlled order:

1. Replace the remaining local-only mutations with backend endpoints where needed.
2. Add authentication and current-user handling.
3. Replace the JSON file store with a real database such as PostgreSQL.
4. Move validation and domain rules into dedicated services as the app grows.
5. Add tests for route validation and cross-entity consistency.

## Recommended next milestone

The best next practical step after this commit is:

1. split route logic into service and repository modules
2. introduce PostgreSQL and Prisma
3. add real authentication and project-level authorization

Once that works, the current file-backed implementation can be replaced without changing the frontend contracts again.
