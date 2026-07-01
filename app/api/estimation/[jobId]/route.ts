import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Serves the initial-estimation PDF for a Job ID from INITIAL_ESTIMATION_FILE_PATH.
 * Files are named like "TL1906-01_yup roy_Initial_Estimation.pdf", so we match
 * by "<jobId>_" prefix (falling back to any PDF containing the job id).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || !["sales", "surveyor"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId: raw } = await params;
  const jobId = decodeURIComponent(raw);
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const dir = env.INITIAL_ESTIMATION_FILE_PATH;
  if (!dir) {
    return NextResponse.json({ error: "Estimation folder not configured" }, { status: 404 });
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return NextResponse.json({ error: "Estimation folder not found" }, { status: 404 });
  }

  const lower = jobId.toLowerCase();
  const match =
    files.find((f) => f.toLowerCase().endsWith(".pdf") && f.toLowerCase().startsWith(`${lower}_`)) ??
    files.find((f) => f.toLowerCase().endsWith(".pdf") && f.toLowerCase().includes(lower));

  if (!match) {
    return NextResponse.json({ error: "No estimation PDF found for this job" }, { status: 404 });
  }

  const buf = await readFile(path.join(dir, match));
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${match.replace(/["\r\n]/g, "")}"`,
    },
  });
}
