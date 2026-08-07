import * as pg from "pg";
const { Pool } = pg.default;

const connectionString =
  process.env.DATABASE_URL ?? process.env.CONNECTION_STRING;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const connectionPool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

export default connectionPool;