"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { photos, surveys } from "@/lib/db/schema";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/** Roles allowed to add/remove survey photos. */
const EDITOR_ROLES = ["surveyor", "sales"] as const;

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !EDITOR_ROLES.includes(session.user.role as (typeof EDITOR_ROLES)[number])) {
    throw new Error("Unauthorized");
  }
}

export type PhotoRecord = {
  id: string;
  section: string;
  blobUrl: string;
};

export async function addPhoto(input: {
  surveyId: string;
  section: string;
  blobUrl: string;
  blobPathname: string;
  contentType?: string;
  sizeBytes?: number;
}): Promise<PhotoRecord> {
  await requireEditor();

  const [survey] = await db.select().from(surveys).where(eq(surveys.id, input.surveyId));
  if (!survey) throw new Error("Survey not found");
  if (survey.status === "submitted") throw new Error("Survey already submitted");

  const [row] = await db
    .insert(photos)
    .values({
      surveyId: input.surveyId,
      section: input.section,
      blobUrl: input.blobUrl,
      blobPathname: input.blobPathname,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    })
    .returning({ id: photos.id, section: photos.section, blobUrl: photos.blobUrl });

  revalidatePath(`/jobs/${encodeURIComponent(survey.jobId)}`);
  return row;
}

export async function deletePhoto(photoId: string): Promise<{ ok: boolean }> {
  await requireEditor();

  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
  if (!photo) return { ok: true };

  // Remove the row first; orphaned files are harmless if unlink fails.
  await db.delete(photos).where(eq(photos.id, photoId));
  try {
    // blobPathname is the stored relative path under public/uploads.
    await unlink(path.join(UPLOAD_ROOT, photo.blobPathname));
  } catch {
    // ignore — file cleanup is best-effort
  }
  return { ok: true };
}
