import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { RefreshLeadsButton } from "@/components/RefreshLeadsButton";
import { Card, CardBody } from "@/components/ui/card";
import { HeroBanner } from "@/components/HeroBanner";

// Always read fresh from the leads cache.
export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  submitted: "bg-green-100 text-green-800",
  none: "bg-slate-100 text-slate-600",
};

export default async function JobsPage() {
  const session = await auth();
  const surveyorId = session?.user?.id;

  const [allLeads, surveyRows] = await Promise.all([
    // Only show jobs assigned to the current surveyor that have been approved
    surveyorId
      ? db
          .select()
          .from(leads)
          .innerJoin(surveys, eq(surveys.jobId, leads.jobId))
          .where(
            and(
              eq(leads.customerApproval, "Y"),
              eq(surveys.surveyorId, surveyorId)
            )
          )
          .orderBy(desc(leads.syncedAt))
          .then((results) => results.map((r) => r.leads))
      : [],
    db.select({ jobId: surveys.jobId, status: surveys.status }).from(surveys),
  ]);

  const statusByJob = new Map(surveyRows.map((s) => [s.jobId, s.status]));

  return (
    <div className="space-y-6">
      <HeroBanner
        title="Your Assigned Surveys"
        subtitle="Complete solar PV site surveys and battery storage assessments"
      >
        <RefreshLeadsButton />
      </HeroBanner>

      {allLeads.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500">
            {!surveyorId ? (
              <>Not authenticated. Please log in.</>
            ) : (
              <>No jobs assigned to you yet. Check back later.</>
            )}
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
