# Synthetic seed data

CSV files ready to `\copy` straight into the `playstore` Postgres database,
with real, spread-out `createdAt` timestamps baked in — a plain `INSERT`
(or Sequelize `.create()`) would default every row's timestamp to "now",
which is exactly the "everything in one time bucket" problem this avoids.
The admin dashboard's downloads-history chart, apps-by-category donut, and
logs table all need this spread to look like anything.

Column shapes were taken directly from the live migrations in
`backend/src/sequelize/config/migrations`, not guessed.

## What's in here

| File                | Rows | Notes |
|---------------------|------|-------|
| `01_users.csv`       | 35   | 1 admin (`admin@storefront.dev`) + 34 regular users. **Solves the "no way to create an admin" gap** noted earlier — this is currently the only way to get an admin account into this backend. |
| `02_categories.csv`  | 10   | Productivity, Games, Photography, Finance, Education, Health & Fitness, Music, Social, Utilities, Developer Tools. |
| `03_applications.csv`| 100  | Spread over the last ~75 days, randomly assigned to a category and an owner. |
| `04_installeds.csv`  | 1000 | Download events — the real source of the downloads charts — spread over the last 30 days with a realistic upward trend toward today, never dated before the app they reference was created. |
| `05_logs.csv`        | 250  | Plausible log lines so the admin Logs screen isn't empty. Purely cosmetic — safe to skip. |

**Every seeded user shares the password `Password123!`** (properly
bcrypt-hashed in the CSV, cost factor 10 — same as the backend uses). Sign
in as `admin@storefront.dev` / `Password123!` to reach the `/admin`
screens, or as any of the other emails in `01_users.csv` for a regular
account.

## One real caveat

`applicationURL` in `03_applications.csv` points at a randomly-generated
filename (e.g. `6194154d-....apk`) that does **not** exist under
`backend/uploads/`. That's fine for populating the database, the admin
dashboard, search, and every screen that just reads rows — but clicking
"Download" on one of these seeded apps will 404, because there's no real
file behind it. If you need working downloads too, drop matching files
into `backend/uploads/` named exactly like the `applicationURL` values, or
just upload a couple of real apps through the UI once you're signed in —
those will work normally.

Images were left out for the same reason (an `Images` row would point at a
screenshot file that doesn't exist either) — add real screenshots through
the app's Edit screen once you're signed in.

## How to import

1. Make sure the backend's migrations have already run against the target
   database (these tables need to exist first).
2. From this folder:

   ```bash
   ./import.sh "postgres://USER:PASSWORD@HOST:PORT/DBNAME"
   ```

   (matches the `DATABASE_URL` in `backend/.env`). Or import one table at a
   time in `psql`:

   ```sql
   \copy "Users"(id, username, email, password, role, "createdAt", "updatedAt")
     FROM '01_users.csv' WITH (FORMAT csv, HEADER true);
   ```

   Import order matters — parents before children (Users/Categories, then
   Applications, then Installeds/Logs) — to satisfy the foreign key
   constraints added in migration `2026.09.16T13.36.57.add-fk-constraints.js`.

3. Regenerating this data (different counts, a fresh date spread, etc.) —
   the generator that produced these CSVs is a single Node script using
   the backend's own `bcrypt` dependency; ask and it can be reshaped or
   re-run with different numbers.
