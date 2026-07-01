import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/** Strip anything that could escape the uploads directory. */
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "x";
}

/**
 * Local-filesystem replacement for Vercel Blob client uploads (dev). Stores the
 * file under public/uploads/... and returns the same { url, pathname } shape the
 * client + addPhoto action expect.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || !["surveyor", "sales"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const surveyId = form.get("surveyId");
  const section = form.get("section");

  if (!(file instanceof File) || typeof surveyId !== "string" || typeof section !== "string") {
    return NextResponse.json({ error: "Missing file, surveyId, or section" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".jpg";
  const fileName = `${safeSegment(path.basename(file.name, path.extname(file.name)))}-${randomUUID()}${ext}`;
  const pathname = `surveys/${safeSegment(surveyId)}/${safeSegment(section)}/${fileName}`;

  const absDir = path.join(UPLOAD_ROOT, path.dirname(pathname));
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(UPLOAD_ROOT, pathname), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/${pathname}`, pathname });
}
