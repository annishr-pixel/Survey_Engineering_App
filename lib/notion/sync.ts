import "server-only";
import { inArray } from "drizzle-orm";
import { notion, notionDataSources } from "./client";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { env } from "@/lib/env";
import * as map from "./map";
import { ENQ, CUST, CUST_PDF_FIELDS, APPROVAL_YES } from "./fields";

/** Ingestion trigger: both must hold on the Enquiries record. */
const ENQUIRY_STATUS_TRIGGER = "Initial Estimation Generated";
const APPROVAL_TRIGGER = APPROVAL_YES;

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
      const status = map.getSelectOrText(p, CUST.status);
      const s = (status ?? "").toLowerCase();
      const relevant =
        s.startsWith(readyStatus) ||
        s.startsWith(FINAL_APPROVED_STATUS.toLowerCase()) ||
        s.startsWith(FINAL_REJECTED_STATUS.toLowerCase());
      if (!relevant) continue;
      out.push({
        customerDetailsPageId: page.id,
        jobId: map.getText(p, CUST.jobId),
        customerName: map.getTitle(p, CUST.customerName),
        address: map.getText(p, CUST.address),
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
    body: { filter: { property: ENQ.jobId, rich_text: { equals: jobId } }, page_size: 1 },
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
    body: { filter: { property: CUST.jobId, rich_text: { equals: jobId } }, page_size: 1 },
  })) as { results: any[] };
  const page = res.results[0];
  if (!page) return null;

  const p = page.properties;
  const fields: Record<string, string> = {};
  for (const name of CUST_PDF_FIELDS) {
    // getAnyText handles every property type (text, select, email, number, date…).
    fields[name.trim()] = map.getAnyText(p, name) ?? "";
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
      filter: { property: ENQ.status, select: { equals: ENQUIRY_STATUS_TRIGGER } },
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
        jobId: map.getText(p, ENQ.jobId),
        customerName: map.getTitle(p, ENQ.customerName),
        initialEstimatedAmount: map.getNumber(p, ENQ.estimatedAmount),
        serviceInterested: map.getMultiSelect(p, ENQ.serviceInterested),
        customerApproval: map.getSelect(p, ENQ.approval),
        reasonForRejection: map.getText(p, ENQ.reasonForRejection),
        status: map.getSelect(p, ENQ.status),
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
          { property: ENQ.status, select: { equals: ENQUIRY_STATUS_TRIGGER } },
          { property: ENQ.approval, select: { equals: APPROVAL_TRIGGER } },
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
    filter: { property: CUST.jobId, rich_text: { equals: jobId } },
    page_size: 1,
  } as any);
  return res.results[0] ?? null;
}

/**
 * Pulls approved leads from Notion and upserts them into the local cache, then
 * prunes cached leads that are no longer approved in Notion (e.g. rows left over
 * from a previous/old database) — but never a lead that already has survey work.
 * One query for Enquiries (paginated) + one per lead for Customer Details.
 */
export async function syncLeads(): Promise<{
  synced: number;
  skipped: number;
  pruned: number;
}> {
  const enquiries = await queryApprovedEnquiries();
  let synced = 0;
  let skipped = 0;
  const syncedJobIds: string[] = [];

  for (const enquiry of enquiries) {
    const e = enquiry.properties;
    const jobId = map.getText(e, ENQ.jobId);
    if (!jobId) {
      skipped++; // cannot join Customer Details without a Job ID
      continue;
    }

    const details = await findCustomerDetails(jobId);
    const d = details ? details.properties : {};

    const amount = map.getNumber(e, ENQ.estimatedAmount);
    const row: LeadInsert = {
      jobId,
      enquiryPageId: enquiry.id,
      customerDetailsPageId: details?.id ?? null,
      customerName: map.getTitle(e, ENQ.customerName) ?? map.getTitle(d, CUST.customerName),
      email: map.getEmail(e, ENQ.email) ?? map.getEmail(d, CUST.email),
      phone: map.getPhone(e, ENQ.phone) ?? map.getPhone(d, CUST.phone),
      address: map.getText(d, CUST.address),
      postcode: null,
      propertyUse: map.parsePropertyUse(map.getSelectOrText(d, CUST.domesticCommercial)),
      serviceInterested: map.getMultiSelect(e, ENQ.serviceInterested),
      initialEstimatedAmount: amount != null ? amount.toString() : null,
      annualConsumptionKwh: map.getText(d, CUST.annualConsumption),
      currentElectricityPrice: map.getText(d, CUST.currentElectricityPrice),
      pvInstalled: map.parseYesNo(map.getSelectOrText(d, CUST.pvInstalled)),
      fitArrangement: map.parseYesNo(map.getSelectOrText(d, CUST.fitArrangement)),
      conservationArea: map.parseYesNo(map.getSelectOrText(d, CUST.conservationArea)),
      councilDetails: map.getText(d, CUST.councilDetails),
      notionStatus: map.getSelect(e, ENQ.status),
      customerApproval: map.getSelect(e, ENQ.approval),
      syncedAt: new Date(),
    };

    await db
      .insert(leads)
      .values(row)
      .onConflictDoUpdate({ target: leads.jobId, set: row });
    syncedJobIds.push(jobId);
    synced++;
  }

  // Prune stale cached leads (e.g. rows synced from the previous database) that
  // are no longer in the approved Notion set. Guard: only prune when we actually
  // received an approved set, and never delete a lead that has a survey attached.
  let pruned = 0;
  if (syncedJobIds.length > 0) {
    const jobIdsWithSurvey = (
      await db.select({ jobId: surveys.jobId }).from(surveys)
    ).map((r) => r.jobId);
    const keep = new Set<string>([...syncedJobIds, ...jobIdsWithSurvey]);
    const cached = await db.select({ jobId: leads.jobId }).from(leads);
    const toDelete = cached.map((r) => r.jobId).filter((j) => !keep.has(j));
    if (toDelete.length > 0) {
      await db.delete(leads).where(inArray(leads.jobId, toDelete));
      pruned = toDelete.length;
    }
  }

  return { synced, skipped, pruned };
}

/**
 * Best-effort write-back of the post-survey status to BOTH Notion databases.
 * `Status` is a select on both databases now (the option is auto-created by
 * Notion if it doesn't exist). Throws on failure so callers can record it for
 * retry.
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
      [ENQ.status]: { select: { name: status } },
    },
  } as any);

  // Customer Details: Status is a select property.
  if (customerDetailsPageId) {
    await notion.pages.update({
      page_id: customerDetailsPageId,
      properties: {
        [CUST.status]: { select: { name: status } },
      },
    } as any);
  }
}
