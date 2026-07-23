import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { inArray, isNotNull } from "drizzle-orm";
import { leads, surveys } from "../lib/db/schema";

/**
 * One-time cleanup: removes stale cached leads (e.g. rows left over from the
 * previous Notion database) so the app starts clean against the new database.
 *
 * SAFE: never deletes a lead that has a survey attached (those are protected to
 * avoid breaking the surveys.lead_id foreign key and losing survey work).
 *
 * Runs against whatever DATABASE_URL points to — set it to the LOCAL url to
 * clean dev, or the PRODUCTION url (Vercel Postgres) to clean production.
 * Read-only preview unless you pass --apply.
 */
const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL(_UNPOOLED) must be set");
  console.log(`DB: ${url.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(APPLY ? "MODE: APPLY (will delete)\n" : "MODE: preview (no changes — pass --apply to delete)\n");

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { casing: "snake_case" });

  try {
    const all = await db.select({ jobId: leads.jobId, name: leads.customerName }).from(leads);
    const withSurvey = new Set(
      (await db.select({ jobId: surveys.jobId }).from(surveys).where(isNotNull(surveys.jobId))).map(
        (r) => r.jobId,
      ),
    );

    const deletable = all.filter((l) => !withSurvey.has(l.jobId));
    const protectedLeads = all.filter((l) => withSurvey.has(l.jobId));

    console.log(`Total cached leads: ${all.length}`);
    console.log(`Protected (have a survey): ${protectedLeads.length}`);
    protectedLeads.forEach((l) => console.log(`   • KEEP ${l.jobId} — ${l.name ?? ""}`));
    console.log(`To delete: ${deletable.length}`);
    deletable.forEach((l) => console.log(`   • DEL  ${l.jobId} — ${l.name ?? ""}`));

    if (APPLY && deletable.length > 0) {
      await db.delete(leads).where(inArray(leads.jobId, deletable.map((l) => l.jobId)));
      console.log(`\n✅ Deleted ${deletable.length} stale lead(s).`);
    } else if (!APPLY) {
      console.log("\n(No changes made. Re-run with --apply to delete.)");
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
