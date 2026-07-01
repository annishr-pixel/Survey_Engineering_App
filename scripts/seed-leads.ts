import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { leads } from "../lib/db/schema";

/**
 * TEMPORARY bridge: loads the currently-approved Notion leads into the local DB
 * so the app is usable before the production NOTION_TOKEN is configured. These
 * mirror live Notion records (Status = "Initial Estimation Generated",
 * Customer Approval = "Y"); the app's own /api/leads/refresh will upsert the
 * authoritative set by Job ID once the integration token is set.
 */
type LeadInsert = typeof leads.$inferInsert;

const rows: LeadInsert[] = [
  {
    jobId: "TL1906-03",
    enquiryPageId: "384ee11a-d705-815c-84a7-fbf54d836d9a",
    customerDetailsPageId: "384ee11a-d705-81a1-8973-c6c932595441",
    customerName: "Tina Mathew",
    email: "Tina@yahoo.com",
    phone: "9998987653",
    address: "abc, 508 Atkin, Westchapel",
    propertyUse: "domestic",
    serviceInterested: ["Solar PV", "Battery Storage"],
    initialEstimatedAmount: "22750",
    annualConsumptionKwh: "23232",
    currentElectricityPrice: "£0.15 per kWh",
    pvInstalled: false,
    fitArrangement: false,
    conservationArea: true,
    councilDetails: "ilfor (Ilford)",
    notionStatus: "Initial Estimation Generated",
    customerApproval: "Y",
  },
  {
    jobId: "TL1906-02",
    enquiryPageId: "384ee11a-d705-81e0-9841-fb2fe480811f",
    customerDetailsPageId: "384ee11a-d705-812f-9967-c933e5eb2d84",
    customerName: "Joe Mathew",
    email: "joe@yahoo.com",
    phone: "678987653",
    address: "66 Roden, Ilford, IG1 2ZR",
    propertyUse: "domestic",
    serviceInterested: ["Solar PV", "Battery Storage"],
    initialEstimatedAmount: "11000",
    annualConsumptionKwh: "4567",
    currentElectricityPrice: "£0.20 per kWh",
    pvInstalled: true,
    fitArrangement: true,
    conservationArea: true,
    councilDetails: "ABC",
    notionStatus: "Initial Estimation Generated",
    customerApproval: "Y",
  },
];

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
