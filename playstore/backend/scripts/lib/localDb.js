// scripts/lib/localDb.js
//
// Forces the seed scripts to always connect to the same physical Postgres
// the docker-compose stack runs, reached via its host-published port
// (localhost:5433 -> the "postgres" service's 5432, see compose.yaml),
// instead of whatever DATABASE_URL happens to be sitting in .env at the
// moment a script is run. That .env value is meant for the *container's*
// internal network hostname ("my-postgres"), which only resolves from
// inside the compose network - running a script on the host with that
// same .env either fails outright (ENOTFOUND my-postgres) or, worse,
// silently succeeds against some other reachable Postgres, writing rows
// into a database the running server never reads from.
//
// Must be imported before ../../src/sequelize/config/database.js anywhere
// in the import graph - that file reads process.env.DATABASE_URL the
// moment it's loaded, so this has to run first. Import it as the very
// first line of any script that needs the real, live database:
//
//   import "./lib/localDb.js";
//   import sequelize, { User, ... } from "../src/sequelize/config/database.js";
//
// Override with SEED_DATABASE_URL if your local Postgres port/credentials
// ever differ from compose.yaml's defaults.
const LOCAL_DATABASE_URL = "postgres://Sethupathi:123123@localhost:5433/postgres";

process.env.DATABASE_URL = process.env.SEED_DATABASE_URL || LOCAL_DATABASE_URL;
