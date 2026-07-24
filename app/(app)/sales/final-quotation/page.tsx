import Link from "next/link";
import { inArray } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { queryFinalQuotationCandidates } from "@/lib/notion/sync";
import { db } from "@/lib/db/client";
import { surveys } from "@/lib/db/schema";
import { Card, CardBody } from "@/components/ui/card";
import { FinalQuotationActions } from "@/components/sales/FinalQuotationActions";
import { HeroBanner } from "@/components/HeroBanner";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

function badge(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("approved for final quotation")) return "bg-green-100 text-green-800";
  if (s.startsWith("rejected for final quotation")) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}
function label(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("approved for final quotation")) return "Approved";
  if (s.startsWith("rejected for final quotation")) return "Rejected";
  return "Awaiting confirmation";
}

export default async function FinalQuotationPage() {
  let rows: Awaited<ReturnType<typeof queryFinalQuotationCandidates>> = [];
  let loadError: string | null = null;
  try {
    rows = await queryFinalQuotationCandidates();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load Customer Details from Notion.";
    await logEvent("error", "final_quotation.page.load_failed", { error: e });
  }

  // Which of these jobs have a submitted survey (gates the PDF download)?
  const jobIds = rows.map((r) => r.jobId).filter((j): j is string => !!j);
  const surveyRows = jobIds.length
    ? await db
        .select({ jobId: surveys.jobId, status: surveys.status })
        .from(surveys)
        .where(inArray(surveys.jobId, jobIds))
    : [];
  const submittedByJob = new Map(surveyRows.map((s) => [s.jobId, s.status === "submitted"]));

  const pending = rows.filter(
    (r) => !(r.status ?? "").toLowerCase().startsWith("approved for final quotation") &&
           !(r.status ?? "").toLowerCase().startsWith("rejected for final quotation"),
  ).length;

  return (
    <div className="space-y-5">
      <div className="mb-4">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <HeroBanner
        title="Final Quotation Approvals"
        subtitle="Review and approve final quotations for completed surveys"
        imageUrl="https://images.unsplash.com/photo-1556742102-c6c3f1dccfd3?w=400&h=400&fit=crop"
        imageAlt="Solar Battery Storage"
      />

      <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
        <p className="text-sm text-slate-700">
          <strong>Ready for Quotation:</strong> {rows.length} ·
          <strong className="ml-4">Awaiting Confirmation:</strong> {pending}
        </p>
      </div>

      {loadError ? (
        <Card>
          <CardBody className="text-center text-red-600">{loadError}</CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500">
            No customer details at &ldquo;Survey done - Ready for Quotation&rdquo; yet.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.customerDetailsPageId}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{r.customerName ?? "Unknown customer"}</p>
                      <p className="text-xs text-slate-500">{r.jobId ?? "—"}</p>
                      <p className="mt-1 text-sm text-slate-600">{r.address ?? "No address on file"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}>
                      {label(r.status)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <FinalQuotationActions
                      customerDetailsPageId={r.customerDetailsPageId}
                      jobId={r.jobId}
                      status={r.status}
                      surveySubmitted={r.jobId ? (submittedByJob.get(r.jobId) ?? false) : false}
                    />
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
