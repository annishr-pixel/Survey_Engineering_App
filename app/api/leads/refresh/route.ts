import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncLeads } from "@/lib/notion/sync";

// Notion SDK + Argon2-guarded auth → Node runtime.
export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "surveyor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLeads();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
