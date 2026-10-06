#!/usr/bin/env bash
# -----------------------------------------------------------------------
# Imports the synthetic seed CSVs directly into Postgres via psql's
# \copy (client-side COPY — works even if psql isn't running on the same
# machine as the DB, unlike server-side COPY).
#
# Run the backend's migrations FIRST (these tables must already exist):
#   cd backend && node src/sequelize/config/cli.js up      # or whatever
#   your migration runner script is called — check package.json
#
# Then, from this directory:
#   ./import.sh "postgres://user:pass@host:port/dbname"
#
# Order matters — parents before children, to satisfy the FK constraints
# added in migration 2026.09.16T13.36.57.add-fk-constraints.js:
#   Users, Categories  ->  Applications  ->  Installeds, Images/Logs
# -----------------------------------------------------------------------
set -euo pipefail

DATABASE_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DATABASE_URL" ]; then
  echo "Usage: ./import.sh <DATABASE_URL>"
  echo "  (or export DATABASE_URL and run ./import.sh with no args)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
\copy "Users"(id, username, email, password, role, "createdAt", "updatedAt") FROM '$SCRIPT_DIR/01_users.csv' WITH (FORMAT csv, HEADER true);
\copy "Categories"(id, name, "createdAt", "updatedAt") FROM '$SCRIPT_DIR/02_categories.csv' WITH (FORMAT csv, HEADER true);
\copy "Applications"(id, "userId", "categoryId", name, description, "applicationURL", "createdAt", "updatedAt") FROM '$SCRIPT_DIR/03_applications.csv' WITH (FORMAT csv, HEADER true);
\copy "Installeds"(id, "userId", "applicationId", "createdAt", "updatedAt") FROM '$SCRIPT_DIR/04_installeds.csv' WITH (FORMAT csv, HEADER true);
\copy "Logs"(id, message, "createdAt") FROM '$SCRIPT_DIR/05_logs.csv' WITH (FORMAT csv, HEADER true);
SQL

echo "Seed data imported."
