# Storefront

A full-stack Play Store–style app marketplace: users publish Android apps
(APK + icon + screenshots), browse and search a catalogue, and install/track
downloads; admins get a moderation and analytics dashboard. Built as a
monorepo with a Node/Express API, a React SPA, and a seed-data kit for local
development.

```
.
├── backend/    Express 5 API — Postgres, OpenSearch, Redis/BullMQ, JWT auth
├── frontend/   React 18 + Vite SPA (plain JavaScript)
└── db-seed/    CSV fixtures + import script for local Postgres
```

## Tech stack

| Layer          | Technology |
|----------------|------------|
| API            | Node.js, Express 5 |
| Database       | PostgreSQL via `@sequelize/core` (v7 alpha), migrated with `umzug` |
| Search         | OpenSearch (app catalogue full-text search) |
| Jobs / cache   | Redis + BullMQ (email, export, search-index workers), rate limiting |
| Auth           | JWT access/refresh tokens, bcrypt password hashing |
| Logging        | Winston, with a custom transport that also writes to Postgres |
| Frontend       | React 18, React Router, Vite, Axios |
| Testing        | Jest (frontend unit), Playwright (frontend e2e) |
| Containers     | Docker Compose (API + Postgres + Redis + OpenSearch) |

## Prerequisites

- Node.js 20+ (Dockerfile targets Node 24)
- Docker + Docker Compose (recommended way to run Postgres/Redis/OpenSearch)
- `npm`

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env   # fill in secrets/connection strings
npm install
docker compose up -d   # Postgres, Redis, OpenSearch (+ the API itself)
npm run migrate        # run pending Sequelize migrations
```

To run the API directly on the host instead of in the `server` container
(e.g. for `--watch` reloads), stop that one service and run:

```bash
npm run dev             # http://localhost:4000, --watch enabled
```

Useful scripts (see `backend/package.json`):

| Script | Purpose |
|---|---|
| `npm run migrate` / `migrate:down` / `migrate:status` | Apply / roll back / inspect Sequelize migrations |
| `npm run migrate:create -- <name>` | Scaffold a new migration file |
| `npm run seed:categories` / `seed:apps` / `seed:downloads` | Generate synthetic data directly via the backend's models |
| `npm run reindex:apps` / `reset:index` | Rebuild / clear the OpenSearch applications index |

Alternatively, `db-seed/` ships ready-made CSVs (35 users incl. one admin,
100 apps, 1000 installs, 250 log lines) — see
[`db-seed/README.md`](db-seed/README.md) for the one-command import and
seeded login credentials.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

In dev mode, Vite proxies `/v1/*` to the backend at `http://localhost:9000`
(the Docker Compose port mapping) — see `frontend/vite.config.js`. Change
the proxy target to `:4000` if you're running the backend bare instead of
via Compose. See [`frontend/README.md`](frontend/README.md) for the
frontend's own layout and known backend-coupling notes.

### 3. Tests

```bash
cd frontend
npm run lint
npm test            # Jest unit tests
npm run test:e2e     # Playwright, needs the full stack running
```

The backend currently has no automated test suite — `backend/src/testing`
holds ad hoc scripts, and `npm test` at the backend root is a placeholder.
Treat this as the top priority gap for anyone hardening this API further.

## Architecture overview

### Request flow

```
Browser (React SPA)
   │  /v1/*  (JSON, JWT bearer)
   ▼
Express app (server.js)
   │
   ├─ blockedIpMiddleware        — hard IP bans, checked on every request
   ├─ /v1/sign/*                 — signup/signin/refresh (IP-rate-limited)
   ├─ /queues                    — Bull Board UI for BullMQ job inspection
   ├─ auth middleware             — verifies the access token
   ├─ per-user rate limiter       — 5 req/s default, keyed by user id
   ├─ /v1/app, /v1/images, /v1/category
   └─ /v1/admin/* (requireAdmin)  — moderation + analytics endpoints
```

- **Auth** (`src/controller/auth.js`, `src/routes/auth.js`): JWT access +
  refresh tokens, refresh-token rotation stored in the `Sessions` table,
  password reset via a short-lived reset token emailed through Nodemailer.
- **Apps** (`src/controller/app.js`): CRUD for app listings, APK upload via
  Multer, catalogue browsing (`hot`, `trending`, `search` — backed by
  OpenSearch), download tracking.
- **Images** (`src/controller/image.js`): icon/screenshot upload and
  retrieval, stored under `backend/app-images` / served by file path.
- **Admin** (`src/controller/admin.js`, `src/controller/export.js`): activity
  log viewer, downloads/category analytics for dashboard charts, and
  CSV/async export jobs processed by a BullMQ worker
  (`src/utils/exportWorker.js`).
- **Background jobs**: `mailWorker.js` (password-reset emails),
  `exportWorker.js` (admin CSV exports), `searchIndexWorker.js`
  (keeps OpenSearch in sync with Postgres writes) — all BullMQ queues
  backed by Redis.
- **Rate limiting** (`src/middlewares/rateLimiter.js`): a Redis-backed
  fixed-window limiter, applied globally per authenticated user and with a
  stricter IP-keyed variant on `/signin` and `/signup`; also exposes
  `blockIp`/`unblockIp` for manual bans.

### API surface

All routes are mounted under `/v1`.

| Base path | Routes file | Notes |
|---|---|---|
| `/v1/sign` | `routes/auth.js` | signup, signin, refresh-token, logout(-all), forgot/reset-password, delete-account, change-password |
| `/v1/app` | `routes/app.js` | list/search/hot/trending, get by id, download, create/update (multipart, APK upload), delete |
| `/v1/images` | `routes/image.js` | list/add/delete app images, fetch an image file |
| `/v1/category` | `routes/category.js` | list/create/delete categories |
| `/v1/admin` | `routes/admin.js` | activity feed, logs (+ CSV export), downloads/category analytics — admin-only |
| `/v1/admin/export` | `routes/export.js` | sync/async download exports, export job status/download — admin-only |
| `/queues` | Bull Board | BullMQ job dashboard |

### Data model

Managed by Sequelize migrations in
`backend/src/sequelize/config/migrations`: `Users`, `Categories`,
`Applications`, `Images`, `Installeds` (download events), `Sessions`
(refresh tokens), `ExportJobs`, `Logs`. Foreign keys (apps → users/
categories, images → apps, etc.) are added in a dedicated migration after
the base tables exist.

## Environment variables

Backend configuration lives in `backend/.env` (gitignored).
[`backend/.env.example`](backend/.env.example) documents every variable the
app reads — secrets, Postgres/Redis/OpenSearch connection info, mail
credentials, and rate-limit tuning. Frontend configuration is the single
`VITE_API_URL` variable in `frontend/.env.development` /
`frontend/.env.production`.

## Known gaps / follow-ups

- **No backend test suite.** `backend/src/testing` is exploratory scripts,
  not an automated suite — there's nothing to run in CI today.
- **No backend linter.** The frontend has an ESLint flat config
  (`frontend/eslint.config.js`); the backend has none. Adding one (even a
  minimal `@eslint/js` recommended config) would catch unused imports and
  inconsistent style before review.
- **Uploaded binaries are stored on the local filesystem**
  (`backend/uploads`, `backend/app-images`) rather than object storage —
  fine for a single instance, but won't survive horizontal scaling or a
  container redeploy without the bind-mounted volume in `compose.yaml`.
- **`frontend/README.md` describes an older file layout** (`src/app`,
  `src/features`, `src/store`) that no longer matches the current
  `src/pages` / `src/components` / `src/context` structure — worth
  refreshing alongside any future frontend restructuring.

## Contributing

See [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
for the expected PR shape (summary, testing done, risk/rollback, secrets
checklist).
