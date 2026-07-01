import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * node-postgres pool — works with any standard Postgres (local Docker, Neon,
 * Supabase, RDS). Reused across hot reloads in dev via a global.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    // Neon/Supabase require TLS; local Docker doesn't present a cert.
    ssl: env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });

export { schema };
