import "dotenv/config";
import https from "node:https";
import tls from "node:tls";
import { Client } from "@notionhq/client";
import { Pool } from "pg";

/**
 * One-off diagnostic (safe, read-only). Replicates the app's Notion connection
 * with the real NOTION_TOKEN + configured DB IDs and reports:
 *   1. Whether the integration can actually access each database
 *   2. The data sources on each database (multi-source detection)
 *   3. The real column names + types (so we can compare to what the code expects)
 *   4. A row count + a small sample from each
 *   5. The local `leads` cache: row count + sample (stale-data check)
 * Nothing is written or modified.
 */

const agent = new https.Agent({
  ca: [...tls.getCACertificates("default"), ...tls.getCACertificates("system")],
});

const token = process.env.NOTION_TOKEN!;
const ENQ = process.env.NOTION_ENQUIRIES_DB_ID!;
const CUST = process.env.NOTION_CUSTOMER_DETAILS_DB_ID!;

const notion = new Client({ auth: token, agent });
const notionDS = new Client({ auth: token, notionVersion: "2025-09-03", agent });

function line(s = "") {
  console.log(s);
}

async function inspectDatabase(label: string, dbId: string) {
  line("");
  line("======================================================================");
  line(`  ${label}`);
  line(`  ID: ${dbId}`);
  line("======================================================================");

  // 1. Can we access it at all? (data-source API, same as the app)
  let dataSources: Array<{ id: string; name: string }> = [];
  let dbTitle = "(unknown)";
  try {
    const dbRes = (await notionDS.request({
      path: `databases/${dbId}`,
      method: "get",
    })) as {
      data_sources?: Array<{ id: string; name: string }>;
      title?: Array<{ plain_text?: string }>;
    };
    dbTitle = dbRes.title?.map((t) => t.plain_text ?? "").join("") || "(no title)";
    dataSources = dbRes.data_sources ?? [];
    line(`  ✅ ACCESS OK — title: "${dbTitle}"`);
  } catch (err: any) {
    line(`  ❌ ACCESS FAILED — ${err?.code ?? ""} ${err?.status ?? ""}: ${err?.message ?? err}`);
    line(`     → The integration behind NOTION_TOKEN cannot see this database.`);
    line(`     → Fix: open the DB in Notion → ••• → Connections → add the integration.`);
    return;
  }

  // 2. Data sources
  line("");
  line(`  Data sources (${dataSources.length}):`);
  for (const s of dataSources) {
    line(`    - "${s.name}"  [${s.id}]`);
  }
  const real =
    dataSources.find((s) => s.name && s.name.toLowerCase() !== "new data source") ??
    dataSources[0];
  if (!real) {
    line("  ❌ No usable data source found.");
    return;
  }
  line(`  → App will use: "${real.name}" [${real.id}]`);

  // 3 + 4. Query the data source: schema (from first row) + count + sample
  try {
    const res = (await notionDS.request({
      path: `data_sources/${real.id}/query`,
      method: "post",
      body: { page_size: 5 },
    })) as { results: any[]; has_more: boolean };

    line("");
    line(`  Rows returned (first page, max 5): ${res.results.length}  (has_more: ${res.has_more})`);

    if (res.results.length > 0) {
      const props = res.results[0].properties as Record<string, any>;
      line("");
      line("  Columns (name → type):");
      for (const [name, val] of Object.entries(props)) {
        line(`    - ${JSON.stringify(name)} → ${val?.type}`);
      }

      line("");
      line("  Sample rows:");
      for (const page of res.results) {
        const p = page.properties as Record<string, any>;
        const cells: string[] = [];
        for (const [name, val] of Object.entries(p)) {
          let v = "";
          switch (val?.type) {
            case "title":
              v = (val.title ?? []).map((r: any) => r.plain_text).join("");
              break;
            case "rich_text":
              v = (val.rich_text ?? []).map((r: any) => r.plain_text).join("");
              break;
            case "select":
              v = val.select?.name ?? "";
              break;
            case "multi_select":
              v = (val.multi_select ?? []).map((o: any) => o.name).join("|");
              break;
            case "number":
              v = val.number != null ? String(val.number) : "";
              break;
            case "email":
              v = val.email ?? "";
              break;
            case "phone_number":
              v = val.phone_number ?? "";
              break;
            default:
              v = `<${val?.type}>`;
          }
          if (v) cells.push(`${name}=${v}`);
        }
        line(`    • ${cells.slice(0, 6).join("  |  ")}`);
      }
    }
  } catch (err: any) {
    line(`  ❌ QUERY FAILED — ${err?.code ?? ""} ${err?.status ?? ""}: ${err?.message ?? err}`);
  }
}

async function inspectLeadsCache() {
  line("");
  line("======================================================================");
  line("  LOCAL POSTGRES — leads cache (stale-data check)");
  line("======================================================================");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    line("  (DATABASE_URL not set — skipping)");
    return;
  }
  line(`  DB: ${url.replace(/:\/\/[^@]*@/, "://***@")}`);
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  try {
    const count = await pool.query("SELECT COUNT(*)::int AS n FROM leads");
    line(`  leads row count: ${count.rows[0].n}`);
    const sample = await pool.query(
      "SELECT job_id, customer_name, notion_status, customer_approval, synced_at FROM leads ORDER BY synced_at DESC LIMIT 10",
    );
    line("");
    line("  Sample (up to 10, newest first):");
    for (const r of sample.rows) {
      line(
        `    • ${r.job_id}  |  ${r.customer_name ?? ""}  |  status=${r.notion_status ?? ""}  |  approval=${r.customer_approval ?? ""}  |  synced=${r.synced_at?.toISOString?.() ?? r.synced_at}`,
      );
    }
  } catch (err: any) {
    line(`  ❌ Postgres query failed: ${err?.message ?? err}`);
    line("     (Local Postgres may not be running — that's fine; the production DB is separate.)");
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  line("Notion connection diagnostic");
  line(`Token present: ${token ? "yes (" + token.slice(0, 7) + "…)" : "NO"}`);
  line(`Enquiries DB ID:        ${ENQ}`);
  line(`Customer Details DB ID: ${CUST}`);

  await inspectDatabase("ENQUIRIES database", ENQ);
  await inspectDatabase("CUSTOMER DETAILS database", CUST);
  await inspectLeadsCache();

  line("");
  line("Diagnostic complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
