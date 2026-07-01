import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { RefreshLeadsButton } from "@/components/RefreshLeadsButton";
import { Card, CardBody } from "@/components/ui/card";

// Always read fresh from the leads cache.
export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  submitted: "bg-green-100 text-green-800",
  none: "bg-slate-100 text-slate-600",
};

export default async function JobsPage() {
  const [allLeads, surveyRows] = await Promise.all([
    // Only show jobs the customer has approved (Customer Approval = "Y" in the
    // Notion Enquiries DB, mirrored into the leads cache). Rejected / pending
    // leads are hidden from the surveyor.
    db
      .select()
      .from(leads)
      .where(eq(leads.customerApproval, "Y"))
      .orderBy(desc(leads.syncedAt)),
    db.select({ jobId: surveys.jobId, status: surveys.status }).from(surveys),
  ]);

  const statusByJob = new Map(surveyRows.map((s) => [s.jobId, s.status]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assigned jobs</h1>
          <p className="text-sm text-slate-500">
            Approved leads pulled from Notion ({allLeads.length}).
          </p>
        </div>
        <RefreshLeadsButton />
      </div>

      {allLeads.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500">
            No leads yet. Click <strong>Refresh leads</strong> to pull approved
            enquiries from Notion.
          </CardBody>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {allLeads.map((lead) => {
            const status = statusByJob.get(lead.jobId) ?? "none";
            return (
              <li key={lead.id}>
                <Link href={`/jobs/${encodeURIComponent(lead.jobId)}`} className="block">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardBody className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {lead.customerName ?? "Unknown customer"}
                          </p>
                          <p className="text-xs text-slate-500">{lead.jobId}</p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[status]}`}
                        >
                          {status === "none" ? "Not started" : status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {lead.address ?? "No address on file"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {lead.propertyUse && <span>{lead.propertyUse}</span>}
                        {lead.serviceInterested?.length ? (
                          <span>{lead.serviceInterested.join(", ")}</span>
                        ) : null}
                        {lead.initialEstimatedAmount && (
                          <span>Est. £{lead.initialEstimatedAmount}</span>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
