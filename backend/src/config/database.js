import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Neon connection strings include sslmode=require. TLS is configured by
  // node-postgres from that URI; do not disable certificate verification.
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "sica-api",
  });

  pool.on("error", (error) => {
    console.error("Unexpected idle PostgreSQL connection error", {
      code: error.code ?? "UNKNOWN",
    });
  });

  return pool;
}

export async function checkDatabase() {
  const result = await getPool().query(
    "SELECT current_database() AS database_name, current_timestamp AS checked_at"
  );
  return result.rows[0];
}

export async function closeDatabase() {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
