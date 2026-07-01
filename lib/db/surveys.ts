import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./client";
import { leads, photos, surveys } from "./schema";
import type { Lead, Photo, Survey } from "./schema";

export async function getLeadByJobId(jobId: string): Promise<Lead | undefined> {
  const [lead] = await db.select().from(leads).where(eq(leads.jobId, jobId));
  return lead;
}

export async function getSurveyByJobId(jobId: string): Promise<Survey | undefined> {
  const [survey] = await db.select().from(surveys).where(eq(surveys.jobId, jobId));
  return survey;
}

/** Returns the existing survey for a job, creating an empty draft on first open. */
export async function getOrCreateDraft(
  jobId: string,
  surveyorId: string,
  leadId: string | null,
): Promise<Survey> {
  const existing = await getSurveyByJobId(jobId);
  if (existing) return existing;

  const [created] = await db
    .insert(surveys)
    .values({ jobId, surveyorId, leadId, status: "draft" })
    .onConflictDoNothing({ target: surveys.jobId })
    .returning();
  if (created) return created;

  // Lost an insert race — re-read.
  const again = await getSurveyByJobId(jobId);
  if (!again) throw new Error(`Failed to create draft for job ${jobId}`);
  return again;
}

export async function getSurveyPhotos(surveyId: string): Promise<Photo[]> {
  return db
    .select()
    .from(photos)
    .where(eq(photos.surveyId, surveyId))
    .orderBy(asc(photos.uploadedAt));
}
