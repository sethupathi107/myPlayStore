import { Client } from "pg";

// The forgot-password flow emails the reset token instead of returning it in
// the response - there's no inbox to read in CI, so we read the token
// straight out of the Sessions table the backend just wrote it to. This
// connects to the same Postgres the backend uses (see backend/.env), from
// the host, on the port docker-compose publishes it on.
const DB_CONFIG = {
  host: process.env.PGHOST_LOCAL || "localhost",
  port: Number(process.env.PGPORT || 5433),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "Sethupathi",
  password: process.env.PGPASSWORD || "123123",
};

export async function latestResetTokenFor(email, { retries = 10, delayMs = 300 } = {}) {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { rows } = await client.query(
        `SELECT s.token
           FROM "Sessions" s
           JOIN "Users" u ON u."id" = s."userId"
          WHERE u.email = $1
          ORDER BY s."createdAt" DESC
          LIMIT 1`,
        [email]
      );
      if (rows.length > 0) return rows[0].token;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`no reset token found in Sessions for ${email} after ${retries} retries`);
  } finally {
    await client.end();
  }
}
