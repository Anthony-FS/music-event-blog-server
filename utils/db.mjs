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

// Supabase/Vercel use certificates that fail strict Node verification.
// Keep SSL on for remote databases, but do not reject the chain.
const connectionPool = new Pool({
  connectionString,
  ssl: isLocalDatabase
    ? undefined
    : {
        require: true,
        rejectUnauthorized: false,
      },
});

export default connectionPool;
