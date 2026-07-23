import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { leads } from "../lib/db/schema";

/**
 * DEPRECATED — do not use in production.
 *
 * This was a one-time bridge that loaded hardcoded sample leads (pointing at an
 * OLD Notion workspace) before the production integration token existed. Leads
 * are now pulled from the live Notion databases by `syncLeads()` — trigger it
 * via the app's "Refresh leads" button or POST /api/leads/refresh.
 *
 * The sample rows have been removed so this script can never re-insert stale
 * old-workspace data. It is intentionally a no-op; kept only for reference.
 */
type LeadInsert = typeof leads.$inferInsert;

const rows: LeadInsert[] = [];

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL(_UNPOOLED) must be set");

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { casing: "snake_case" });

  for (const row of rows) {
    await db
      .insert(leads)
      .values({ ...row, syncedAt: new Date() })
      .onConflictDoUpdate({ target: leads.jobId, set: { ...row, syncedAt: new Date() } });
    console.log(`Upserted lead ${row.jobId} — ${row.customerName}`);
  }

  console.log("Lead seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
