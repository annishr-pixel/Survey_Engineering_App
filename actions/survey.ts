"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { getSurveyByJobId } from "@/lib/db/surveys";
import { draftSchema, submitSchema } from "@/lib/validation/survey";
import { pushReadyForQuotation } from "@/lib/notion/sync";
import { sendSurveySubmittedEmail } from "@/lib/email";

/** Top-level (typed column) keys — everything in the schema except `extras`. */
const COLUMN_KEYS = Object.keys(draftSchema.shape).filter((k) => k !== "extras");

export type ActionResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Roles allowed to edit/submit surveys. */
const EDITOR_ROLES = ["surveyor", "sales"] as const;

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !EDITOR_ROLES.includes(session.user.role as (typeof EDITOR_ROLES)[number])) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/** Splits validated form data into typed columns + cleaned extras JSONB. */
function toRow(data: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const key of COLUMN_KEYS) {
    // Form always submits every field; `undefined` means cleared → null.
    row[key] = data[key] ?? null;
  }
  const extrasIn = (data.extras ?? {}) as Record<string, unknown>;
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(extrasIn)) {
    if (typeof v === "string" && v.length > 0) extras[k] = v;
  }
  row.extras = extras;
  return row;
}

export async function saveDraft(
  jobId: string,
  values: unknown,
): Promise<ActionResult> {
  await requireEditor();

  const existing = await getSurveyByJobId(jobId);
  if (existing && existing.status === "submitted") {
    return { ok: false, error: "This survey has already been submitted." };
  }

  const parsed = draftSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid.", fieldErrors: flatten(parsed.error) };
  }

  await db
    .update(surveys)
    .set({ ...toRow(parsed.data as Record<string, unknown>), updatedAt: new Date() })
    .where(eq(surveys.jobId, jobId));

  return { ok: true, savedAt: new Date().toISOString() };
}

export async function submitSurvey(
  jobId: string,
  values: unknown,
): Promise<ActionResult> {
  await requireEditor();

  const existing = await getSurveyByJobId(jobId);
  if (!existing) return { ok: false, error: "Survey not found." };
  if (existing.status === "submitted") {
    return { ok: false, error: "This survey has already been submitted." };
  }

  const parsed = submitSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please complete the required fields before submitting.",
      fieldErrors: flatten(parsed.error),
    };
  }

  // 1) Commit the survey first — never lose it to a Notion outage.
  await db
    .update(surveys)
    .set({
      ...toRow(parsed.data as Record<string, unknown>),
      status: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(surveys.jobId, jobId));

  // 2) Best-effort Notion write-back.
  const [lead] = await db.select().from(leads).where(eq(leads.jobId, jobId));
  if (lead?.enquiryPageId) {
    try {
      await pushReadyForQuotation(lead.enquiryPageId, lead.customerDetailsPageId);
      await db
        .update(surveys)
        .set({ notionPushed: true })
        .where(eq(surveys.jobId, jobId));
    } catch {
      // Leave notionPushed=false; surfaced on the confirmation page for retry.
    }
  }

  // 3) Best-effort email notification to the sales team.
  try {
    await sendSurveySubmittedEmail({
      jobId,
      customerName: lead?.customerName,
      address: lead?.address,
    });
  } catch (e) {
    console.error("[email] sales notification failed:", e);
  }

  revalidatePath("/jobs");
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Retry the Notion status push for an already-submitted survey. */
export async function retryNotionPush(jobId: string): Promise<ActionResult> {
  await requireEditor();
  const survey = await getSurveyByJobId(jobId);
  if (!survey) return { ok: false, error: "Survey not found." };

  const [lead] = await db.select().from(leads).where(eq(leads.jobId, jobId));
  if (!lead?.enquiryPageId) return { ok: false, error: "No linked Notion enquiry." };

  try {
    await pushReadyForQuotation(lead.enquiryPageId, lead.customerDetailsPageId);
    await db.update(surveys).set({ notionPushed: true }).where(eq(surveys.jobId, jobId));
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Notion push failed." };
  }
}

/**
 * Reopens a submitted survey for editing: flips the status back to "draft" so
 * the form, photo uploader, and autosave become editable again. The surveyor
 * re-submits when done, which re-pushes the Notion status.
 */
export async function reopenSurvey(jobId: string): Promise<ActionResult> {
  await requireEditor();
  const survey = await getSurveyByJobId(jobId);
  if (!survey) return { ok: false, error: "Survey not found." };

  await db
    .update(surveys)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(surveys.jobId, jobId));

  revalidatePath(`/jobs/${encodeURIComponent(jobId)}`);
  return { ok: true, savedAt: new Date().toISOString() };
}

function flatten(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
