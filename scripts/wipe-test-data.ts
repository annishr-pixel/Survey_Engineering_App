import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { leads, surveys, photos } from "../lib/db/schema";

/**
 * ONE-TIME full wipe of cached app data (leads + surveys + photos) so the app
 * starts clean against the new Notion database. DESTRUCTIVE.
 *
 * Deletes in FK-safe order: photos → surveys → leads.
 *
 * Target DB precedence: TARGET_DATABASE_URL > DATABASE_URL_UNPOOLED > DATABASE_URL.
 * To wipe PRODUCTION, run with the production connection string, e.g.:
 *   $env:TARGET_DATABASE_URL="<prod-url>"; $env:NODE_OPTIONS="--use-system-ca";
 *   npx tsx scripts/wipe-test-data.ts --apply
 *
 * Preview only (no changes) unless you pass --apply.
 */
const APPLY = process.argv.includes("--apply");

async function main() {
  const url =
    process.env.TARGET_DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL / TARGET_DATABASE_URL set");

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  console.log(`DB: ${url.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`Target: ${isLocal ? "LOCAL" : "REMOTE (production?)"}`);
  console.log(APPLY ? "MODE: APPLY — will DELETE ALL leads/surveys/photos\n" : "MODE: preview (no changes — pass --apply to delete)\n");

  const pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { casing: "snake_case" });

  try {
    const [l, s, p] = [
      (await db.select({ id: leads.id }).from(leads)).length,
      (await db.select({ id: surveys.id }).from(surveys)).length,
      (await db.select({ id: photos.id }).from(photos)).length,
    ];
    console.log(`Current counts → leads: ${l}, surveys: ${s}, photos: ${p}`);

    if (!APPLY) {
      console.log("\nWould delete ALL of the above. Re-run with --apply to execute.");
      return;
    }
    if (l + s + p === 0) {
      console.log("\nNothing to delete — already clean.");
      return;
    }

    // FK-safe order.
    const dp = await db.delete(photos).returning({ id: photos.id });
    const ds = await db.delete(surveys).returning({ id: surveys.id });
    const dl = await db.delete(leads).returning({ id: leads.id });
    console.log(`\n✅ Deleted → photos: ${dp.length}, surveys: ${ds.length}, leads: ${dl.length}`);
    console.log("Cache is now clean. Use the app's 'Refresh leads' to pull the live Notion data.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
