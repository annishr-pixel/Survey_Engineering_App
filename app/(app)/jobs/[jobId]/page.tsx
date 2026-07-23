import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getLeadByJobId,
  getOrCreateDraft,
  getSurveyPhotos,
  getSurveyByJobId,
} from "@/lib/db/surveys";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { Card, CardBody } from "@/components/ui/card";
import type { PhotoRecord } from "@/actions/photo";

export const dynamic = "force-dynamic";

export default async function JobSurveyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: rawJobId } = await params;
  const jobId = decodeURIComponent(rawJobId);

  const session = await auth();
  const surveyorId = session!.user.id;

  const lead = await getLeadByJobId(jobId);
  const existingSurvey = await getSurveyByJobId(jobId);

  // Check if survey is assigned to this surveyor
  if (existingSurvey && existingSurvey.surveyorId && existingSurvey.surveyorId !== surveyorId) {
    return (
      <div className="space-y-4">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" /> All jobs
        </Link>
        <Card>
          <CardBody className="text-center text-red-600">
            This job is not assigned to you. Please contact your manager.
          </CardBody>
        </Card>
      </div>
    );
  }

  const survey = await getOrCreateDraft(jobId, surveyorId, lead?.id ?? null);
  const photos = await getSurveyPhotos(survey.id);

  const photosBySection: Record<string, PhotoRecord[]> = {};
  for (const p of photos) {
    (photosBySection[p.section] ??= []).push({
      id: p.id,
      section: p.section,
      blobUrl: p.blobUrl,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" /> All jobs
          </Link>
          <h1 className="mt-1 text-xl font-semibold">
            {lead?.customerName ?? jobId}
          </h1>
        </div>
      </div>

      <SurveyForm survey={survey} lead={lead} photosBySection={photosBySection} />
    </div>
  );
}
