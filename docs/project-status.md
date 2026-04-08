# Project Status

Updated: 2026-04-08

This document summarizes what is currently implemented in the project, what is partially implemented, and what still remains before the app can be considered a production-ready full-stack service.

## 1. Current Stack

### Frontend

- Language: TypeScript
- Framework: React 19
- Build tool: Vite
- Routing: `react-router-dom`
- State management: Zustand
- Styling: Tailwind CSS

### Backend

- Language: JavaScript
- Runtime: Node.js
- Module system: ESM (`.mjs`)
- HTTP server: Node built-in `http`
- Environment variables: `dotenv`
- AI integration: `openai`

### Persistence

- Default live persistence: JSON files
- Database path prepared: PostgreSQL + Prisma
- Prisma driver support: `@prisma/adapter-pg`

## 2. What Is Already Implemented

### 2.1 Frontend application shell

The core frontend app is already built and routable.

- Login page
- Dashboard page
- Projects list page
- Project detail page
- Calendar page
- Settings page
- Not found page
- Shared app layout with sidebar and assistant panel

### 2.2 Domain models and UI workflow

The main domain used throughout the app is already defined and rendered in the UI.

- Users
- Projects
- Tasks
- Documents
- Schedules
- Timetable blocks

The frontend is no longer just a static mockup. It can create, update, and delete core records through the backend API.

### 2.3 Backend API foundation

The backend already has a layered structure.

- Entry point: `server.mjs`
- Route layer
- Validation layer
- Service layer
- Repository layer
- Persistence layer

Current API coverage includes:

- Auth session endpoints
- Project CRUD
- Task CRUD
- Document CRUD
- Schedule create/update/delete
- Timetable block create
- User role update
- Lab bootstrap endpoint
- Assistant chat endpoint

### 2.4 Authentication

Authentication is now implemented as a working MVP.

- Register account
- Login
- Logout
- Restore active session from cookie
- Protect app routes on the frontend
- Protect lab API routes on the backend
- Seed users can log in with password `password`

Current auth behavior:

- The browser receives an `HttpOnly` session cookie
- `/api/auth/session` restores the logged-in user
- `/api/lab/*` routes require authentication
- Logged-out users are redirected to `/login`

### 2.5 Persistence and saved data

The app now saves data beyond browser memory.

- Lab data is stored in `backend/data/lab-data.json`
- Auth data is stored in `backend/data/auth-data.json`

This means the following currently persist across refreshes and server restarts:

- Registered accounts
- Login sessions until logout or expiry
- Created projects
- Created and updated tasks
- Created and updated documents
- Created and updated schedules
- Timetable blocks

### 2.6 Prisma preparation

Prisma is not just scaffolded anymore. The project now supports switching repository drivers.

- File repository driver exists
- Prisma repository driver exists
- Driver is selected with `LAB_REPOSITORY_DRIVER`
- Prisma schema is defined
- Prisma client generation works
- `prisma db push` script exists

Important limitation:

- The Prisma driver is prepared, but it is not the default live path yet
- Without a running PostgreSQL instance, the Prisma driver returns a database connection failure

### 2.7 Assistant integration

The AI assistant area is already connected to the app flow.

- Assistant panel exists in the layout
- Workspace context is constructed from current app state
- Assistant API route exists
- Some local task/document/project actions are already recognized

This is still an early orchestration layer, not a fully trusted autonomous backend workflow.

## 3. What Is Partially Implemented

### 3.1 Full frontend-to-backend sync

The app is already API-backed, but not every interaction is equally mature.

- Main create/update/delete flows are connected
- Some local optimistic updates still assume success first
- Failure rollback is limited
- Error surfaces are still minimal

### 3.2 Authorization

Authentication exists, but authorization is still weak.

- User role values exist: `Admin`, `Member`, `Viewer`
- Current user role can be changed
- Role labels are reflected in the UI

What is still missing:

- Real permission guards per route/action
- Project membership checks per mutation
- Admin-only or owner-only restrictions

### 3.3 Database transition

The codebase is prepared for PostgreSQL + Prisma, but the app still runs primarily on file persistence.

- Schema is ready
- Repository implementation is ready
- Runtime driver switch exists

Still missing:

- Real local PostgreSQL setup in active use
- Schema application and migration history
- Full CRUD verification on Prisma path
- Auth persistence migration to Prisma

### 3.4 Authentication feature depth

Current login and signup are enough for an MVP, but not enough for a production system.

Implemented:

- Session cookie
- Signup
- Login
- Logout
- Session restore

Still missing:

- Password reset
- Email verification
- Password change
- Account profile editing
- Session management UI
- Brute-force protection

## 4. What Is Not Implemented Yet

### 4.1 Production-grade backend security

- CSRF protection
- Rate limiting
- Secure audit logging
- Strong input sanitization policy for all auth edges
- Hardened session storage

### 4.2 Production-grade database usage

- Live PostgreSQL environment as the default path
- Prisma migrations in normal team workflow
- Backup strategy
- Real data migration from JSON files to DB

### 4.3 Automated testing

There is no proper automated test suite yet for the main product flows.

Missing areas:

- Validation tests
- Auth flow tests
- Service layer tests
- API integration tests
- Regression tests for document/task linkage

### 4.4 Operational tooling

- Structured request logging
- Error monitoring
- Readiness checks beyond a simple health route
- Deployment configuration
- Environment validation on startup

## 5. Practical Current Status

The project is best described as:

- Frontend MVP: strong
- Backend foundation: established
- Authentication: working MVP
- Persistence: working, but file-based by default
- Database migration path: prepared
- Production readiness: not yet

In plain terms:

- You can log in
- You can sign up
- You can create and modify project data
- That data is saved
- The app behaves like a real early-stage full-stack product

But:

- It is still not a production-safe service
- It still relies on JSON files by default
- It still needs stronger authorization, DB adoption, and tests

## 6. Recommended Next Steps

### Priority 1

- Make PostgreSQL + Prisma the real active persistence layer
- Run and verify the app on the Prisma driver
- Add migration-based DB setup

### Priority 2

- Add project-level authorization checks
- Restrict sensitive actions by role
- Prevent non-members from changing project data

### Priority 3

- Add password change and account profile update
- Add better auth error messages and loading states
- Improve optimistic update rollback handling

### Priority 4

- Add automated tests for auth and CRUD flows
- Add route/service integration tests
- Add backend startup checks for required environment variables

### Priority 5

- Improve deployment and observability
- Add structured logs
- Add monitoring and failure diagnostics

## 7. Short Summary

At this point, the project has moved beyond a frontend-only prototype.

It is now:

- a working React frontend
- a working Node backend
- a working session-based auth MVP
- a working saved-data system using JSON persistence
- a prepared PostgreSQL + Prisma migration path

The next major milestone is turning the current MVP backend into a true database-backed, permission-aware service.
