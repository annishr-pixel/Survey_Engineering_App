import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { getSurveyByJobId, getLeadByJobId, getSurveyPhotos } from "@/lib/db/surveys";
import { SECTIONS, type FieldDef } from "@/lib/survey-sections";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Survey, Photo } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Format a stored survey value for read-only display. */
function displayValue(field: FieldDef, survey: Survey): string {
  let raw: unknown;
  if (field.name.startsWith("extras.")) {
    const extras = (survey.extras ?? {}) as Record<string, string>;
    raw = extras[field.name.slice("extras.".length)];
  } else {
    raw = (survey as Record<string, unknown>)[field.name];
  }

  if (raw == null || raw === "") return "—";
  if (field.type === "bool") return raw === true ? "Yes" : raw === false ? "No" : "—";
  if (field.type === "multi") {
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return "—";
    return arr.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v)).join(", ");
  }
  if (field.type === "enum") {
    return field.options?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  return String(raw);
}

export default async function SalesSurveyDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: rawJobId } = await params;
  const jobId = decodeURIComponent(rawJobId);

  const survey = await getSurveyByJobId(jobId);
  const lead = await getLeadByJobId(jobId);

  if (!survey || survey.status !== "submitted") {
    return (
      <div className="space-y-4">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> Completed surveys
        </Link>
        <Card>
          <CardBody className="text-center text-slate-500">
            No submitted survey found for this job.
          </CardBody>
        </Card>
      </div>
    );
  }

  const photos = await getSurveyPhotos(survey.id);
  const photosBySection: Record<string, Photo[]> = {};
  for (const p of photos) (photosBySection[p.section] ??= []).push(p);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> Completed surveys
        </Link>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{lead?.customerName ?? jobId}</h1>
          <Link href={`/sales/${encodeURIComponent(jobId)}/edit`}>
            <Button>Edit</Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          Job {jobId}
          {survey.submittedAt
            ? ` · submitted ${new Date(survey.submittedAt).toLocaleString("en-GB")}`
            : ""}
        </p>
      </div>

      {/* 3.1 Customer & Site (from Notion) */}
      <Card>
        <CardHeader>
          <CardTitle>3.1 Customer &amp; Site (from Notion)</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Detail label="Customer" value={lead?.customerName} />
          <Detail label="Job ID" value={survey.jobId} />
          <Detail label="Property" value={lead?.propertyUse} />
          <Detail label="Address" value={lead?.address} />
          <Detail label="Phone" value={lead?.phone} />
          <Detail label="Email" value={lead?.email} />
          <Detail label="Annual kWh" value={lead?.annualConsumptionKwh} />
          <Detail label="Service" value={lead?.serviceInterested?.join(", ")} />
          <Detail
            label="Initial est."
            value={lead?.initialEstimatedAmount ? `£${lead.initialEstimatedAmount}` : null}
          />
        </CardBody>
      </Card>

      {SECTIONS.map((section) => {
        const sectionPhotos = photosBySection[section.id] ?? [];
        return (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle>
                {section.id} {section.title}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{field.label}</dt>
                    <dd className="whitespace-pre-wrap text-slate-800">{displayValue(field, survey)}</dd>
                  </div>
                ))}
              </dl>

              {sectionPhotos.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                    Photos ({sectionPhotos.length})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {sectionPhotos.map((p) => (
                      <a
                        key={p.id}
                        href={p.blobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200 hover:ring-2 hover:ring-brand"
                      >
                        <Image src={p.blobUrl} alt="Survey photo" fill sizes="96px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value || "—"}</dd>
    </div>
  );
}
