import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Main query pool — large enough for 80+ concurrent requests
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 80,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Dedicated pool for express-session so session reads/writes never
// starve application queries under heavy concurrent load (50+ employees).
export const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
