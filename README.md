# RoomSync

[![CI](https://github.com/elanurlaktas/roomsync/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/elanurlaktas/roomsync/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](#testing--coverage)
[![Node](https://img.shields.io/badge/node-24.x-339933?logo=node.js&logoColor=white)](api/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](api/tsconfig.json)

> **⚠️ This is a portfolio / demo project.** RoomSync was **not** built for a real
> organization — it's a practice project with a deliberately limited scope,
> focused on a handful of specific backend and full-stack engineering topics.
> This is a deliberate, transparent choice, not something hidden away.

## What is RoomSync?

RoomSync is a shared meeting-room booking system — a simplified version of
real-world tools like Skedda, Robin, or OfficeRnD. Employees can browse rooms
and book them for a time slot; the system guarantees, **at the database
level**, that two people can never double-book the same room at the same time.

## Live Demo

| | |
|---|---|
| **Admin panel** | **[roomsync-web.onrender.com](https://roomsync-web.onrender.com)** |
| **Swagger / API docs** | **[roomsync-api-7s04.onrender.com/api-docs](https://roomsync-api-7s04.onrender.com/api-docs)** |
| **Demo credentials** | `demo@roomsync.dev` / `demo1234` (admin — pre-seeded, see [`api/src/db/seed.ts`](api/src/db/seed.ts)) |

> Hosted on Render's free tier — the first request after a period of
> inactivity may take ~30-60s to wake the service up.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Decisions](#architecture-decisions)
- [The Most Important Test](#the-most-important-test-preventing-double-bookings)
- [API & Documentation](#api--documentation)
- [Getting Started](#getting-started)
- [Testing & Coverage](#testing--coverage)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap--whats-not-done-yet)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Express + TypeScript (`strict: true`) |
| Frontend | Next.js (App Router) + shadcn/ui + Tailwind CSS |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | JWT (access + refresh, rotation) + bcryptjs |
| Validation | Zod |
| API docs | Swagger UI + `@asteasolutions/zod-to-openapi` (generated from the same Zod schemas used for validation) |
| Rate limiting | express-rate-limit (general + stricter login limit) |
| Logging | pino (structured/JSON logs) |
| Testing | Vitest + Supertest |
| CI | GitHub Actions |
| Container | Docker Compose (multi-stage, ARM64-compatible) — see [Getting Started](#getting-started) |
| Deploy | Render (both `api` and `web` deployed as Docker containers straight from their `Dockerfile`s) |

## Architecture Decisions

Short "why", not just "what" — these are the reasoning behind the choices that
might not be obvious from the code alone.

### Preventing double-bookings (two layers, not one)

Two time ranges overlap iff `start_a < end_b AND start_b < end_a`. Checking
this in application code is fast and gives a friendly `409 Conflict`, but on
its own it's vulnerable to a race condition: two requests for the same room
can both pass the check at nearly the same instant and both get inserted.

RoomSync uses **two layers**:

1. **Application layer** — a SQL query checks for overlapping, non-cancelled
   bookings for the room before inserting. Fast, gives a clean error message.
2. **Database layer (the actual guarantee)** — a PostgreSQL `EXCLUDE USING
   gist` constraint (via the `btree_gist` extension) makes it *physically
   impossible* for two overlapping, non-cancelled bookings to exist for the
   same room, no matter how the race plays out:

   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;

   ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
     EXCLUDE USING gist (
       room_id WITH =,
       tstzrange(starts_at, ends_at) WITH &&
     ) WHERE (status <> 'cancelled');
   ```

   Drizzle ORM has no TypeScript API for exclusion constraints, so this one
   piece of SQL is hand-written directly into a migration file.

   When the constraint is violated, Postgres returns error code `23P01`,
   which the service layer catches and turns into a clean `409 BOOKING_CONFLICT`
   JSON response instead of a raw database error.

### Why a monorepo

`api/` and `web/` are tightly coupled, developed together, and deployed
together. Splitting them into two repos would have added version-sync and
double-PR overhead with no real benefit at this project's scale. A monorepo
kept setup and review simpler.

### Why Next.js (for a panel simple enough for plain React)

The panel itself is small enough that plain React would have been enough, but
Next.js is what I already use in production and have App Router/Server
Components experience with, so it was faster and more consistent to reach for
it here. It also leaves room to grow into SSR/SEO later if the admin panel
ever needed it.

### Why Drizzle

I already had Next.js-side experience with it, and its SQL-like query builder
(as opposed to a heavier, more "magic" ORM) made it a good fit for a backend
where being explicit about queries — especially the overlap-detection SQL
above — mattered.

## The Most Important Test: Preventing Double-Bookings

The exclusion constraint above is only worth something if it's proven to work
under real concurrency, not just in theory. `api/tests/integration/bookings.test.ts`
fires **two simultaneous** `POST /bookings` requests for the *same room* and
the *same overlapping time range* via `Promise.all`, then asserts that
**exactly one** of the two responses is `201 Created` and the other is
`409 Conflict` — regardless of which one happens to resolve first:

```ts
const [resA, resB] = await Promise.all([
  request(app).post('/bookings').send(overlappingBookingA),
  request(app).post('/bookings').send(overlappingBookingB),
]);

const statuses = [resA.status, resB.status].sort((a, b) => a - b);
expect(statuses).toEqual([201, 409]);
```

If the database-level constraint didn't exist, this test would be flaky —
sometimes both requests would slip through the application-level check at the
same time and both would succeed, silently double-booking the room.

## API & Documentation

Full interactive documentation (request/response schemas, try-it-out) is
generated automatically from the same Zod schemas used for request validation
and served at **`/api-docs`** (raw JSON at `/api-docs.json`) once the API is
running locally.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Health check (used by Docker/CI) |
| POST | `/auth/register` | – | Register (role is always `member`) |
| POST | `/auth/login` | – | Log in; returns an access token + refresh cookie |
| POST | `/auth/refresh` | cookie | Rotate refresh token, issue a new access token |
| POST | `/auth/logout` | ✅ | Invalidate the refresh token |
| GET | `/rooms` | ✅ | List active rooms |
| GET | `/rooms/:id` | ✅ | Get a single room |
| GET | `/rooms/:id/availability?date=YYYY-MM-DD` | ✅ | Free time slots for a given day |
| POST | `/rooms` | ✅ admin | Create a room |
| PATCH | `/rooms/:id` | ✅ admin | Update a room |
| DELETE | `/rooms/:id` | ✅ admin | Deactivate a room (soft delete) |
| GET | `/bookings?cursor=&limit=` | ✅ | List bookings (own for `member`, all for `admin`); cursor-based pagination |
| POST | `/bookings` | ✅ | Create a booking (`409` if the room is already booked for that time) |
| GET | `/bookings/:id` | ✅ | Get a single booking (`403` if it's not yours and you're not an admin) |
| PATCH | `/bookings/:id/cancel` | ✅ | Cancel a booking (owner or admin only) |

All error responses share one shape (see `api/src/utils/ApiError.ts` and
`api/src/middleware/error.middleware.ts`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable message", "details": {} } }
```

`details` is optional and, for validation errors, points at which field(s)
failed.

**Notes:**
- All timestamps are stored and returned in UTC (`timestamptz`). The
  `availability` endpoint's `date` query parameter is interpreted as a
  `Europe/Istanbul` calendar day and converted to UTC internally.
- `/health` and `/api-docs` are exempt from rate limiting (health checks and
  documentation browsing shouldn't be throttled); every other route shares a
  general limit (100 requests / 15 min per IP), and `/auth/login` has an
  additional, stricter limit (5 requests / 15 min per IP) against brute-force
  attempts.

## Getting Started

### Option A — Docker Compose (recommended, one command)

Brings up `db` + `api` + `web` from scratch — migrations run automatically on
`api` startup, a deliberate design choice to avoid forgotten migrations during
deploy.

```bash
cp .env.example .env
# fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (e.g. `openssl rand -base64 32`)
docker compose up --build
```

- Panel: **http://localhost:3000**
- API / Swagger: **http://localhost:4000/api-docs**

`CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` are read from the root `.env` (no
hardcoded domains) — override them there if you're pointing at a non-`localhost`
setup. Note `NEXT_PUBLIC_API_URL` is baked into the panel's client bundle at
**build** time, so changing it requires `docker compose up --build` again, not
just a restart. There's no seed data yet, so register a user via the panel's
login screen (or `POST /auth/register`) and promote it to `admin` directly in
the database to manage rooms.

Both `api/Dockerfile` and `web/Dockerfile` are multi-stage and use the
official (multi-arch) `node:24-alpine` image, keeping the setup portable
across hosts (including ARM64 servers) regardless of where it's deployed —
the [live demo](#live-demo) above currently runs on Render, built directly
from these same Dockerfiles.

### Option B — Running the API directly on your machine

**Prerequisites:** Node.js 24.x, npm, and a running PostgreSQL 16+ instance.

If you don't already have Postgres running locally, the quickest way to get
one is:

```bash
docker run -d --name roomsync-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=roomsync \
  -p 5432:5432 postgres:16
```

Then set up the API:

```bash
cd api
npm install
cp .env.example .env
```

Edit `api/.env` and fill in `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with
strong random values (e.g. `openssl rand -base64 32`), then point
`DATABASE_URL` at your Postgres instance (the `.env.example` default matches
the `docker run` command above out of the box).

```bash
npm run db:migrate   # apply migrations (creates roomsync's tables + constraints)
npm run dev          # starts the API on http://localhost:4000 with hot-reload
```

Open **http://localhost:4000/api-docs** to explore and try the API.

## Testing & Coverage

Tests run against a **separate** database (`.env.test`, loaded via
`dotenv-cli`) so they never touch your dev data:

```bash
cd api
cp .env.example .env.test   # then point DATABASE_URL at a *different* database, e.g. roomsync_test
npm run db:migrate:test     # apply migrations to the test database
npm test                    # run the full test suite
npm run test:coverage       # same, plus a coverage report + threshold check (>= 70%)
```

Statement/branch/function/line coverage is enforced at **70%+** via
`vitest.config.ts`'s `coverage.thresholds` — the same command that generates
the report also fails the build if coverage regresses below that bar, and CI
runs it on every push/PR to `main`.

## Project Structure

```
roomsync/
  api/                    Express backend
    src/
      modules/            auth/ rooms/ bookings/ — routes → controller → service → repository
      db/                 Drizzle schema + migrations
      middleware/         auth, validation, rate limiting, centralized error handling
      docs/               OpenAPI document generation (Swagger UI)
      config/, utils/
    tests/
      unit/               pure functions, middleware in isolation
      integration/        full HTTP request/response cycles against a real test DB
  web/                    Next.js admin panel
  docker-compose.yml      Local dev: api + web + db (no nginx — see Dockerfiles)
  .github/workflows/      CI (lint, typecheck, test+coverage, build)
```

## Roadmap — what's not done yet

The project is live (see [Live Demo](#live-demo)), but a few things were
deliberately left out at this scale:

- **Custom domain / own TLS** — the live demo currently runs on Render's
  default `*.onrender.com` subdomains rather than a custom domain with its
  own certificate.
- **Automated migrate + seed on deploy** — `npm run db:migrate` and
  `npm run seed` were run by hand against the production database once,
  rather than as an automatic step in the deploy pipeline.
- **Multi-instance rate limiting** — `express-rate-limit`'s in-memory store
  resets on every redeploy/restart and wouldn't be shared across multiple
  instances; fine for a single free-tier container, not for real horizontal
  scaling.

