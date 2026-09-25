import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL in .env.local before using the database.");
}

// Reuse the pool across Next.js development reloads.
const globalForDb = globalThis as unknown as { flowdocsPool?: Pool };
const pool = globalForDb.flowdocsPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== "production") globalForDb.flowdocsPool = pool;

export const db = drizzle({ client: pool, schema });
