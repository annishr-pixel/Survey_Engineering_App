"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { notion } from "@/lib/notion/client";
import {
  syncLeads,
  getEnquiryPageIdByJobId,
  FINAL_APPROVED_STATUS,
  FINAL_REJECTED_STATUS,
} from "@/lib/notion/sync";
import { logEvent } from "@/lib/logger";

async function requireSales() {
  const session = await auth();
  if (!session?.user || session.user.role !== "sales") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export type ApprovalResult = { ok: true } | { ok: false; error: string };

/**
 * Customer opted in for the survey → set Notion Enquiries "Customer Approval"
 * to "Y", then sync so the approved lead appears in the surveyor's job list.
 */
export async function approveCustomer(enquiryPageId: string): Promise<ApprovalResult> {
  await requireSales();
  try {
    await notion.pages.update({
      page_id: enquiryPageId,
      properties: { "Customer Approval": { select: { name: "Y" } } },
    } as any);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Notion update failed." };
  }

  // Best-effort: pull the now-approved lead into the surveyor job list.
  try {
    await syncLeads();
  } catch {
    // ignore — surveyor can also press "Refresh leads"
  }

  // Mirror the decision into Postgres (leads cache).
  try {
    const upd = await db
      .update(leads)
      .set({ customerApproval: "Y", reasonForRejection: null })
      .where(eq(leads.enquiryPageId, enquiryPageId))
      .returning({ id: leads.id });
    await logEvent("info", "initial_approval.approve.leads_updated", { enquiryPageId, rowsUpdated: upd.length });
  } catch (e) {
    await logEvent("error", "initial_approval.approve.leads_update_failed", { enquiryPageId, error: e });
  }

  revalidatePath("/sales/survey-approvals");
  revalidatePath("/jobs");
  return { ok: true };
}

/**
 * Customer declined → set "Customer Approval" to "N" and record the reason in
 * the Notion "Reason for Rejection" field. A reason is required.
 */
export async function rejectCustomer(
  enquiryPageId: string,
  reason: string,
): Promise<ApprovalResult> {
  await requireSales();
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { ok: false, error: "A rejection reason is required." };

  try {
    await notion.pages.update({
      page_id: enquiryPageId,
      properties: {
        "Customer Approval": { select: { name: "N" } },
        "Reason for Rejection": { rich_text: [{ text: { content: trimmed } }] },
        Status: { select: { name: "Rejected" } },
      },
    } as any);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Notion update failed." };
  }

  // Mirror the rejection into Postgres (leads cache).
  try {
    const upd = await db
      .update(leads)
      .set({ customerApproval: "N", reasonForRejection: trimmed, notionStatus: "Rejected" })
      .where(eq(leads.enquiryPageId, enquiryPageId))
      .returning({ id: leads.id });
    await logEvent("info", "initial_approval.reject.leads_updated", { enquiryPageId, reason: trimmed, rowsUpdated: upd.length });
  } catch (e) {
    await logEvent("error", "initial_approval.reject.leads_update_failed", { enquiryPageId, error: e });
  }

  revalidatePath("/sales/survey-approvals");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Final-quotation approval (Customer Details, Status = Form Received) */
/* ------------------------------------------------------------------ */

/**
 * Customer confirmed the final quotation → writes to BOTH Notion databases:
 *   • Customer Details "Status" (text) = "Approved for Final Quotation"
 *   • Treadlight Website Enquiries (matched by Job ID): Status = "Approved for
 *     Final Quotation" (select) and Customer Approval = "Y".
 * Detailed step-by-step logging is written to the log folder.
 */
export async function approveFinalQuotation(
  customerDetailsPageId: string,
  jobId: string | null,
): Promise<ApprovalResult> {
  const user = await requireSales();
  const ctx = {
    action: "approveFinalQuotation",
    actor: user.email,
    actorId: user.id,
    jobId,
    customerDetailsPageId,
    approvedStatus: FINAL_APPROVED_STATUS,
    customerApproval: "Y",
  };
  await logEvent("info", "final_quotation.approve.start", ctx);

  try {
    // 1) Customer Details status text
    await notion.pages.update({
      page_id: customerDetailsPageId,
      properties: { Status: { rich_text: [{ text: { content: FINAL_APPROVED_STATUS } }] } },
    } as any);
    await logEvent("info", "final_quotation.approve.customer_details_updated", {
      ...ctx,
      wrote: { db: "Customer Details", field: "Status", value: FINAL_APPROVED_STATUS },
    });

    // 2) Enquiries (Treadlight Website Enquiries): Status + Customer Approval = Y
    const enquiryPageId = jobId ? await getEnquiryPageIdByJobId(jobId) : null;
    if (enquiryPageId) {
      await notion.pages.update({
        page_id: enquiryPageId,
        properties: {
          Status: { select: { name: FINAL_APPROVED_STATUS } },
          "Customer Approval": { select: { name: "Y" } },
        },
      } as any);
      await logEvent("info", "final_quotation.approve.enquiries_updated", {
        ...ctx,
        enquiryPageId,
        wrote: {
          db: "Treadlight Website Enquiries",
          fields: { Status: FINAL_APPROVED_STATUS, "Customer Approval": "Y" },
        },
      });
    } else {
      await logEvent("warn", "final_quotation.approve.enquiry_not_found", {
        ...ctx,
        note: "No Enquiries record matched this Job ID; Customer Details updated only.",
      });
    }

    // 3) Mirror into Postgres (leads cache).
    if (jobId) {
      const upd = await db
        .update(leads)
        .set({ customerApproval: "Y", notionStatus: FINAL_APPROVED_STATUS, reasonForRejection: null })
        .where(eq(leads.jobId, jobId))
        .returning({ id: leads.id });
      await logEvent("info", "final_quotation.approve.leads_updated", { ...ctx, rowsUpdated: upd.length });
    }

    await logEvent("info", "final_quotation.approve.success", { ...ctx, enquiryPageId });
  } catch (e) {
    await logEvent("error", "final_quotation.approve.failed", { ...ctx, error: e });
    return { ok: false, error: e instanceof Error ? e.message : "Notion update failed." };
  }

  revalidatePath("/sales/final-quotation");
  return { ok: true };
}

/**
 * Customer declined the final quotation → writes to BOTH databases:
 *   • Customer Details "Status" = "Rejected for Final Quotation — <reason>"
 *   • Enquiries (by Job ID): Customer Approval = "N", Reason for Rejection = reason.
 * A reason is required. Detailed step-by-step logging is written.
 */
export async function rejectFinalQuotation(
  customerDetailsPageId: string,
  jobId: string | null,
  reason: string,
): Promise<ApprovalResult> {
  const user = await requireSales();
  const trimmed = (reason ?? "").trim();
  const ctx = {
    action: "rejectFinalQuotation",
    actor: user.email,
    actorId: user.id,
    jobId,
    customerDetailsPageId,
    reason: trimmed,
  };

  if (!trimmed) {
    await logEvent("warn", "final_quotation.reject.missing_reason", ctx);
    return { ok: false, error: "A rejection reason is required." };
  }
  await logEvent("info", "final_quotation.reject.start", ctx);

  const statusText = `${FINAL_REJECTED_STATUS} — ${trimmed}`;
  try {
    // 1) Customer Details status text (with reason appended)
    await notion.pages.update({
      page_id: customerDetailsPageId,
      properties: { Status: { rich_text: [{ text: { content: statusText } }] } },
    } as any);
    await logEvent("info", "final_quotation.reject.customer_details_updated", {
      ...ctx,
      wrote: { db: "Customer Details", field: "Status", value: statusText },
    });

    // 2) Enquiries: Customer Approval = N + Reason for Rejection
    const enquiryPageId = jobId ? await getEnquiryPageIdByJobId(jobId) : null;
    if (enquiryPageId) {
      await notion.pages.update({
        page_id: enquiryPageId,
        properties: {
          "Customer Approval": { select: { name: "N" } },
          "Reason for Rejection": { rich_text: [{ text: { content: trimmed } }] },
        },
      } as any);
      await logEvent("info", "final_quotation.reject.enquiries_updated", {
        ...ctx,
        enquiryPageId,
        wrote: {
          db: "Treadlight Website Enquiries",
          fields: { "Customer Approval": "N", "Reason for Rejection": trimmed },
        },
      });
    } else {
      await logEvent("warn", "final_quotation.reject.enquiry_not_found", ctx);
    }

    // 3) Mirror the rejection into Postgres (leads cache).
    if (jobId) {
      const upd = await db
        .update(leads)
        .set({ customerApproval: "N", notionStatus: FINAL_REJECTED_STATUS, reasonForRejection: trimmed })
        .where(eq(leads.jobId, jobId))
        .returning({ id: leads.id });
      await logEvent("info", "final_quotation.reject.leads_updated", { ...ctx, rowsUpdated: upd.length });
    }

    await logEvent("info", "final_quotation.reject.success", { ...ctx, enquiryPageId });
  } catch (e) {
    await logEvent("error", "final_quotation.reject.failed", { ...ctx, error: e });
    return { ok: false, error: e instanceof Error ? e.message : "Notion update failed." };
  }

  revalidatePath("/sales/final-quotation");
  return { ok: true };
}
