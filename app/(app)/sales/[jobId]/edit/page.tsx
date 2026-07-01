import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLeadByJobId, getSurveyByJobId, getSurveyPhotos } from "@/lib/db/surveys";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { Card, CardBody } from "@/components/ui/card";
import type { PhotoRecord } from "@/actions/photo";

export const dynamic = "force-dynamic";

export default async function SalesSurveyEditPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: rawJobId } = await params;
  const jobId = decodeURIComponent(rawJobId);

  const survey = await getSurveyByJobId(jobId);
  const lead = await getLeadByJobId(jobId);

  if (!survey) {
    return (
      <div className="space-y-4">
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" /> Completed surveys
        </Link>
        <Card>
          <CardBody className="text-center text-slate-500">No survey found for this job.</CardBody>
        </Card>
      </div>
    );
  }

  const photos = await getSurveyPhotos(survey.id);
  const photosBySection: Record<string, PhotoRecord[]> = {};
  for (const p of photos) {
    (photosBySection[p.section] ??= []).push({ id: p.id, section: p.section, blobUrl: p.blobUrl });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/sales/${encodeURIComponent(jobId)}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" /> Back to survey
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{lead?.customerName ?? jobId}</h1>
        <p className="text-sm text-slate-500">
          Editing as sales. A submitted survey must be reopened (&ldquo;Edit survey&rdquo;) before
          changes can be made.
        </p>
      </div>

      <SurveyForm
        survey={survey}
        lead={lead}
        photosBySection={photosBySection}
        submittedHref={`/sales/${encodeURIComponent(jobId)}`}
      />
    </div>
  );
}
