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

## Deploying to Render

[`render.yaml`](render.yaml) is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions the whole stack: the backend as a Docker web service, a
managed Postgres, a managed Redis, OpenSearch as an internal-only private
service, and the frontend as a static site.

> Vercel is **not** a fit for the backend — it's serverless-only and can't
> run the long-lived Postgres/Redis/OpenSearch processes or BullMQ workers
> this app needs. The frontend alone could go on Vercel, but then you'd
> still need somewhere like Render for the backend anyway, so this uses
> Render for both.

1. Push this repo to GitHub (already done if you're reading this on
   GitHub) and connect it to Render.
2. In the Render dashboard: **New +** → **Blueprint** → pick this repo and
   branch. Render parses `render.yaml` and lists every service it's about
   to create.
3. Before clicking **Apply**, fill in the env vars marked `sync: false`
   in the blueprint that Render can't infer on its own:
   - `storefront-opensearch`: `OPENSEARCH_INITIAL_ADMIN_PASSWORD` — any
     value; it's unused while `plugins.security.disabled=true`, but the
     image still requires it to be set.
   - `storefront-backend`: `GMAIL_USER` / `GMAIL_APP_PASSWORD` — needed
     for password-reset emails (`src/utils/mailer.js`).
4. Click **Apply**. First deploy will take a few minutes.
5. Run migrations by hand — the free plan doesn't support
   `preDeployCommand`. Open `storefront-backend`'s **Shell** tab in Render
   and run:
   ```bash
   node src/sequelize/config/cli.js up
   ```
   (Repeat this after any future deploy that adds a new migration.)
6. Once `storefront-backend` and `storefront-frontend` both have live
   `.onrender.com` URLs, go back into each service's **Environment** tab
   and set the two remaining placeholders, then manually redeploy both:
   - `storefront-backend` → `CORS_ORIGIN` = the frontend's URL
   - `storefront-frontend` → `VITE_API_URL` = the backend's URL + `/v1`
     (Vite bakes this in at build time, hence the redeploy)
7. Load the seed data (optional) — run `db-seed/import.sh` against the
   `storefront-postgres` external connection string shown in Render's
   dashboard, exactly as described in
   [`db-seed/README.md`](db-seed/README.md).
8. After every cold start (the free backend/OpenSearch services sleep
   after 15 minutes idle and lose anything not in Postgres on wake), open
   `storefront-backend`'s **Shell** tab in Render and run
   `node src/opensearch/reindexApplications.js` to rebuild the search
   index — otherwise `/v1/app/search` returns nothing until it's rebuilt.

**This blueprint is set to Render's free tier everywhere, which means:**
- `storefront-postgres` / `storefront-redis`: free databases expire after
  90 days and need recreating (and re-seeding) — fine for a demo/portfolio
  deploy, not for anything you need to keep running indefinitely.
- `storefront-backend` / `storefront-opensearch`: free services spin down
  after ~15 minutes idle; the next request wakes them back up but eats a
  cold-start delay (worse for OpenSearch, a JVM app, on 512MB RAM).
- **No persistent disks on the free plan** — anything written to
  `backend/uploads` (uploaded APKs, uploaded images via
  `src/middlewares/uploadImage.js`) is **lost** on every restart/redeploy/
  wake-from-sleep. Same for the OpenSearch index (see step 7 above) — but
  that one's harmless since Postgres is the real source of truth and the
  index is just rebuilt from it.
- `backend/app-images` is unaffected either way — it's committed seed/demo
  content baked into the image at build time, nothing writes to it at
  runtime.
- Bump the relevant `plan:` fields to `starter` (~$7/mo each) and add back
  a `disk:` block on `storefront-backend` once uploads need to actually
  persist, or once the cold-start delay becomes a real problem.
- This was written against Render's blueprint spec as documented at the
  time; field names (`runtime`, `type: redis`, etc.) do shift over time —
  if Render's dashboard rejects a field, check their current
  [Blueprint YAML reference](https://render.com/docs/blueprint-spec) for
  the current name.

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
