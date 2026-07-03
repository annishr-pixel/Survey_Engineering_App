import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Serves the initial-estimation PDF for a Job ID from Vercel Blob storage.
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

  const lower = jobId.toLowerCase();

  let blobs;
  try {
    const result = await list();
    blobs = result.blobs;
  } catch {
    return NextResponse.json({ error: "Estimation storage not available" }, { status: 500 });
  }

  const match =
    blobs.find((b) => b.pathname.toLowerCase().endsWith(".pdf") && b.pathname.toLowerCase().startsWith(`${lower}_`)) ??
    blobs.find((b) => b.pathname.toLowerCase().endsWith(".pdf") && b.pathname.toLowerCase().includes(lower));

  if (!match) {
    return NextResponse.json({ error: "No estimation PDF found for this job" }, { status: 404 });
  }

  const fileRes = await fetch(match.url);
  if (!fileRes.ok) {
    return NextResponse.json({ error: "Failed to retrieve estimation PDF" }, { status: 502 });
  }
  const buf = Buffer.from(await fileRes.arrayBuffer());

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${match.pathname.replace(/["\r\n]/g, "")}"`,
    },
  });
}