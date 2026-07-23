import "dotenv/config";
import https from "node:https";
import tls from "node:tls";
import { Client } from "@notionhq/client";
import { ENQ, CUST, CUST_PDF_FIELDS, APPROVAL_YES } from "../lib/notion/fields";
import * as map from "../lib/notion/map";

/**
 * Functional verification (read-only). Uses the REAL fields.ts + map.ts against
 * the live databases to confirm the app's queries now return populated values
 * instead of blanks. Mirrors sync.ts logic without touching Postgres.
 */
const agent = new https.Agent({
  ca: [...tls.getCACertificates("default"), ...tls.getCACertificates("system")],
});
const token = process.env.NOTION_TOKEN!;
const notionDS = new Client({ auth: token, notionVersion: "2025-09-03", agent });

async function realDataSourceId(dbId: string): Promise<string> {
  const dbRes = (await notionDS.request({ path: `databases/${dbId}`, method: "get" })) as {
    data_sources?: Array<{ id: string; name: string }>;
  };
  const s = dbRes.data_sources ?? [];
  return (s.find((x) => x.name?.toLowerCase() !== "new data source") ?? s[0]).id;
}

async function main() {
  const ok = (b: boolean) => (b ? "✅" : "❌");

  // ---- Enquiries: survey-approvals view ----
  console.log("\n=== queryEstimatesForApproval (Enquiries, Status='Initial Estimation Generated') ===");
  const enqDs = await realDataSourceId(process.env.NOTION_ENQUIRIES_DB_ID!);
  const enqRes = (await notionDS.request({
    path: `data_sources/${enqDs}/query`,
    method: "post",
    body: {
      filter: { property: ENQ.status, select: { equals: "Initial Estimation Generated" } },
      page_size: 5,
    },
  })) as { results: any[] };
  console.log(`Matched rows: ${enqRes.results.length}`);
  for (const page of enqRes.results) {
    const p = page.properties;
    const row = {
      jobId: map.getText(p, ENQ.jobId),
      customerName: map.getTitle(p, ENQ.customerName),
      amount: map.getNumber(p, ENQ.estimatedAmount),
      services: map.getMultiSelect(p, ENQ.serviceInterested),
      approval: map.getSelect(p, ENQ.approval),
      status: map.getSelect(p, ENQ.status),
    };
    console.log(
      `  ${ok(!!row.jobId && !!row.customerName)} ${row.jobId} | ${row.customerName} | £${row.amount ?? "—"} | [${row.services.join(", ")}] | approval=${row.approval ?? "—"} | ${row.status}`,
    );
  }

  // ---- Approved set used by syncLeads ----
  console.log(`\n=== queryApprovedEnquiries (Status trigger AND ${ENQ.approval}='${APPROVAL_YES}') ===`);
  const apprRes = (await notionDS.request({
    path: `data_sources/${enqDs}/query`,
    method: "post",
    body: {
      filter: {
        and: [
          { property: ENQ.status, select: { equals: "Initial Estimation Generated" } },
          { property: ENQ.approval, select: { equals: APPROVAL_YES } },
        ],
      },
      page_size: 5,
    },
  })) as { results: any[] };
  console.log(`Approved leads ready to sync: ${apprRes.results.length}`);
  if (apprRes.results.length === 0) {
    console.log(
      `  ℹ️  None yet — expected: '${ENQ.approval}' has no "${APPROVAL_YES}" values until sales approves a customer in the app.`,
    );
  }

  // ---- Customer Details: field mapping (PDF + lead join) ----
  console.log("\n=== Customer Details field mapping (getAnyText over CUST_PDF_FIELDS) ===");
  const custDs = await realDataSourceId(process.env.NOTION_CUSTOMER_DETAILS_DB_ID!);
  const custRes = (await notionDS.request({
    path: `data_sources/${custDs}/query`,
    method: "post",
    body: { page_size: 2 },
  })) as { results: any[] };
  for (const page of custRes.results) {
    const p = page.properties;
    console.log(`  Job ${map.getText(p, CUST.jobId)} — ${map.getTitle(p, CUST.customerName)}`);
    let populated = 0;
    for (const name of CUST_PDF_FIELDS) {
      const v = map.getAnyText(p, name);
      if (v) populated++;
      console.log(`      ${v ? "•" : "·"} ${name}: ${v ?? "(blank)"}`);
    }
    console.log(`    → ${populated}/${CUST_PDF_FIELDS.length} fields populated`);
    // spot-check the fields that feed the leads cache
    console.log(
      `    lead-join check: address=${ok(!!map.getText(p, CUST.address))} pv=${map.parseYesNo(map.getSelectOrText(p, CUST.pvInstalled))} fit=${map.parseYesNo(map.getSelectOrText(p, CUST.fitArrangement))} conservation=${map.parseYesNo(map.getSelectOrText(p, CUST.conservationArea))} use=${map.parsePropertyUse(map.getSelectOrText(p, CUST.domesticCommercial))}`,
    );
  }

  console.log("\nVerification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
