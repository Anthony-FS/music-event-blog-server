import * as pg from "pg";
const { Pool } = pg.default;

const connectionString =
  process.env.DATABASE_URL ?? process.env.CONNECTION_STRING;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const isLocalDatabase =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

const connectionPool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production" || !isLocalDatabase
      ? { rejectUnauthorized: false }
      : undefined,
});

export default connectionPool;
