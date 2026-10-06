import { Pool } from "pg";
import { logger } from "./logger.js";

// A separate pg.Pool intended to point at a read replica, so heavy
// analytical/export reads don't compete with live app traffic on the
// primary database. There is no real streaming replica provisioned in
// this project yet (that is genuine Postgres infrastructure work - a
// second Postgres instance configured for streaming replication, a
// replication role, and primary-side WAL settings - not something an
// application file can create on its own). Until REPLICA_DATABASE_URL is
// pointed at a real replica, this deliberately falls back to the primary
// so the app keeps working, and logs a clear warning every time it does,
// so the gap is never silently invisible.
const replicaUrl = process.env.REPLICA_DATABASE_URL;

if (!replicaUrl) {
    logger.error(
        "REPLICA_DATABASE_URL is not set - export reads are falling back to the primary database (DATABASE_URL) instead of a replica."
    );
}

const pool = new Pool({
    connectionString: replicaUrl || process.env.DATABASE_URL,
});

pool.on("error", (err) => {
    logger.error(`pg replica pool error: ${err.message}`);
});

export default pool;
