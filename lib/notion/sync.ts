import "server-only";
import { notion, notionDataSources } from "./client";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { env } from "@/lib/env";
import * as map from "./map";

/** Ingestion trigger: both must hold on the Enquiries record. */
const ENQUIRY_STATUS_TRIGGER = "Initial Estimation Generated";
const APPROVAL_TRIGGER = "Y";

type LeadInsert = typeof leads.$inferInsert;

/**
 * The Enquiries database has more than one data source (a stray empty "New data
 * source" was left behind by an import), so it can't be queried by database_id
 * on the 2022-06-28 API. We resolve the real data source once and query it
 * directly via the 2025-09-03 data-source endpoint.
 */
let cachedEnquiriesDataSourceId: string | null = null;

async function resolveEnquiriesDataSourceId(): Promise<string> {
  if (cachedEnquiriesDataSourceId) return cachedEnquiriesDataSourceId;
  const dbRes = (await notionDataSources.request({
    path: `databases/${env.NOTION_ENQUIRIES_DB_ID}`,
    method: "get",
  })) as { data_sources?: Array<{ id: string; name: string }> };

  const sources = dbRes.data_sources ?? [];
  // Skip the empty "New data source" import artifact; fall back to the first.
  const real =
    sources.find((s) => s.name && s.name.toLowerCase() !== "new data source") ??
    sources[0];
  if (!real) {
    throw new Error("No data source found on the Enquiries database");
  }
  cachedEnquiriesDataSourceId = real.id;
  return real.id;
}

/* ---- Customer Details: final-quotation approval stage ---- */

/** Status values relevant to the final-quotation page. */
export const FORM_RECEIVED_STATUS = "Form Received";
export const FINAL_APPROVED_STATUS = "Approved for Final Quotation";
export const FINAL_REJECTED_STATUS = "Rejected for Final Quotation";

let cachedCustomerDetailsDataSourceId: string | null = null;

async function resolveCustomerDetailsDataSourceId(): Promise<string> {
  if (cachedCustomerDetailsDataSourceId) return cachedCustomerDetailsDataSourceId;
  const dbRes = (await notionDataSources.request({
    path: `databases/${env.NOTION_CUSTOMER_DETAILS_DB_ID}`,
    method: "get",
  })) as { data_sources?: Array<{ id: string; name: string }> };
  const sources = dbRes.data_sources ?? [];
  const real =
    sources.find((s) => s.name && s.name.toLowerCase() !== "new data source") ?? sources[0];
  if (!real) throw new Error("No data source found on the Customer Details database");
  cachedCustomerDetailsDataSourceId = real.id;
  return real.id;
}

export type FinalQuotationCandidate = {
  customerDetailsPageId: string;
  jobId: string | null;
  customerName: string | null;
  address: string | null;
  status: string | null;
};

/**
 * Customer Details records at the final-quotation stage: those awaiting a
 * decision (Status = "Form Received") plus those already decided, so the
 * download option stays available after approval.
 */
export async function queryFinalQuotationCandidates(): Promise<FinalQuotationCandidate[]> {
  const dataSourceId = await resolveCustomerDetailsDataSourceId();
  const out: FinalQuotationCandidate[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = (await notionDataSources.request({
      path: `data_sources/${dataSourceId}/query`,
      method: "post",
      body,
    })) as { results: any[]; has_more: boolean; next_cursor: string | null };

    const readyStatus = env.NOTION_READY_STATUS_NAME.toLowerCase();
    for (const page of res.results) {
      const p = page.properties;
      const status = map.getText(p, "Status");
      const s = (status ?? "").toLowerCase();
      const relevant =
        s.startsWith(readyStatus) ||
        s.startsWith(FINAL_APPROVED_STATUS.toLowerCase()) ||
        s.startsWith(FINAL_REJECTED_STATUS.toLowerCase());
      if (!relevant) continue;
      out.push({
        customerDetailsPageId: page.id,
        jobId: map.getText(p, "Job ID"),
        customerName: map.getTitle(p, "Customer Name"),
        address: map.getText(p, "Address"),
        status,
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/** Finds the Enquiries page id for a Job ID (null if none). */
export async function getEnquiryPageIdByJobId(jobId: string): Promise<string | null> {
  const dataSourceId = await resolveEnquiriesDataSourceId();
  const res = (await notionDataSources.request({
    path: `data_sources/${dataSourceId}/query`,
    method: "post",
    body: { filter: { property: "Job ID", rich_text: { equals: jobId } }, page_size: 1 },
  })) as { results: any[] };
  return res.results[0]?.id ?? null;
}

/** Full Customer Details field map for one job (used by the PDF export). */
export async function getCustomerDetailsByJobId(
  jobId: string,
): Promise<{ pageId: string; fields: Record<string, string> } | null> {
  const dataSourceId = await resolveCustomerDetailsDataSourceId();
  const res = (await notionDataSources.request({
    path: `data_sources/${dataSourceId}/query`,
    method: "post",
    body: { filter: { property: "Job ID", rich_text: { equals: jobId } }, page_size: 1 },
  })) as { results: any[] };
  const page = res.results[0];
  if (!page) return null;

  const p = page.properties;
  const fieldNames = [
    "Customer Name", "Job ID", "Address", "Email", "Phone Number", "Domestic/Commercial",
    "Annual Energy Consumption(Kwh)", "Current Electricity Price", "PV Installed(Y/N)",
    "FIT Arrangement (Y/N)", "Conservation area(Y/N)", "Council details",
    "EV/ASHP/Electric boilder/All", "Preferences of solar panel installation",
    "Preferred timeframe ", "Battery Storage Pricing(Y/N)", "Plans/Drawings", "Status",
  ];
  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const title = map.getTitle(p, name);
    const num = map.getNumber(p, name);
    const val = map.getText(p, name) ?? title ?? (num != null ? String(num) : null);
    fields[name.trim()] = val ?? "";
  }
  return { pageId: page.id, fields };
}

export type EstimateForApproval = {
  enquiryPageId: string;
  jobId: string | null;
  customerName: string | null;
  initialEstimatedAmount: number | null;
  serviceInterested: string[];
  customerApproval: string | null; // "Y" | "N" | null
  reasonForRejection: string | null;
  status: string | null;
};

/**
 * Enquiries that have an initial estimate and are awaiting (or have received) a
 * customer-approval decision by sales. Queries the Enquiries data source live.
 */
export async function queryEstimatesForApproval(): Promise<EstimateForApproval[]> {
  const dataSourceId = await resolveEnquiriesDataSourceId();
  const out: EstimateForApproval[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: { property: "Status", select: { equals: ENQUIRY_STATUS_TRIGGER } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = (await notionDataSources.request({
      path: `data_sources/${dataSourceId}/query`,
      method: "post",
      body,
    })) as { results: any[]; has_more: boolean; next_cursor: string | null };

    for (const page of res.results) {
      const p = page.properties;
      out.push({
        enquiryPageId: page.id,
        jobId: map.getText(p, "Job ID"),
        customerName: map.getTitle(p, "Customer Name"),
        initialEstimatedAmount: map.getNumber(p, "Initial Estimated Amount"),
        serviceInterested: map.getMultiSelect(p, "Service Interested"),
        customerApproval: map.getSelect(p, "Customer Approval"),
        reasonForRejection: map.getText(p, "Reason for Rejection"),
        status: map.getSelect(p, "Status"),
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function queryApprovedEnquiries(): Promise<any[]> {
  const dataSourceId = await resolveEnquiriesDataSourceId();
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: {
        and: [
          { property: "Status", select: { equals: ENQUIRY_STATUS_TRIGGER } },
          { property: "Customer Approval", select: { equals: APPROVAL_TRIGGER } },
        ],
      },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = (await notionDataSources.request({
      path: `data_sources/${dataSourceId}/query`,
      method: "post",
      body,
    })) as { results: any[]; has_more: boolean; next_cursor: string | null };

    out.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function findCustomerDetails(jobId: string): Promise<any | null> {
  const res = await notion.databases.query({
    database_id: env.NOTION_CUSTOMER_DETAILS_DB_ID,
    filter: { property: "Job ID", rich_text: { equals: jobId } },
    page_size: 1,
  } as any);
  return res.results[0] ?? null;
}

/**
 * Pulls approved leads from Notion and upserts them into the local cache.
 * One query for Enquiries (paginated) + one per lead for Customer Details.
 */
export async function syncLeads(): Promise<{ synced: number; skipped: number }> {
  const enquiries = await queryApprovedEnquiries();
  let synced = 0;
  let skipped = 0;

  for (const enquiry of enquiries) {
    const e = enquiry.properties;
    const jobId = map.getText(e, "Job ID");
    if (!jobId) {
      skipped++; // cannot join Customer Details without a Job ID
      continue;
    }

    const details = await findCustomerDetails(jobId);
    const d = details ? details.properties : {};

    const amount = map.getNumber(e, "Initial Estimated Amount");
    const row: LeadInsert = {
      jobId,
      enquiryPageId: enquiry.id,
      customerDetailsPageId: details?.id ?? null,
      customerName: map.getTitle(e, "Customer Name") ?? map.getTitle(d, "Customer Name"),
      email: map.getEmail(e, "Email") ?? map.getEmail(d, "Email"),
      phone: map.getPhone(e, "Phone Number") ?? map.getPhone(d, "Phone Number"),
      address: map.getText(d, "Address"),
      postcode: null,
      propertyUse: map.parsePropertyUse(map.getText(d, "Domestic/Commercial")),
      serviceInterested: map.getMultiSelect(e, "Service Interested"),
      initialEstimatedAmount: amount != null ? amount.toString() : null,
      annualConsumptionKwh: map.getText(d, "Annual Energy Consumption(Kwh)"),
      currentElectricityPrice: map.getText(d, "Current Electricity Price"),
      pvInstalled: map.parseYesNo(map.getText(d, "PV Installed(Y/N)")),
      fitArrangement: map.parseYesNo(map.getText(d, "FIT Arrangement (Y/N)")),
      conservationArea: map.parseYesNo(map.getText(d, "Conservation area(Y/N)")),
      councilDetails: map.getText(d, "Council details"),
      notionStatus: map.getSelect(e, "Status"),
      customerApproval: map.getSelect(e, "Customer Approval"),
      syncedAt: new Date(),
    };

    await db
      .insert(leads)
      .values(row)
      .onConflictDoUpdate({ target: leads.jobId, set: row });
    synced++;
  }

  return { synced, skipped };
}

/**
 * Best-effort write-back of the post-survey status to BOTH Notion databases.
 * The Enquiries `Status` is a select (the option is auto-created by Notion if
 * missing); the Customer Details `Status` is a plain text property, so it takes
 * a rich_text value. Throws on failure so callers can record it for retry.
 */
export async function pushReadyForQuotation(
  enquiryPageId: string,
  customerDetailsPageId?: string | null,
): Promise<void> {
  const status = env.NOTION_READY_STATUS_NAME;

  // Enquiries: Status is a select property.
  await notion.pages.update({
    page_id: enquiryPageId,
    properties: {
      Status: { select: { name: status } },
    },
  } as any);

  // Customer Details: Status is a plain text (rich_text) property.
  if (customerDetailsPageId) {
    await notion.pages.update({
      page_id: customerDetailsPageId,
      properties: {
        Status: { rich_text: [{ text: { content: status } }] },
      },
    } as any);
  }
}
