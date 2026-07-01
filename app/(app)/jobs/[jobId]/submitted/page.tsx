import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { getSurveyByJobId, getLeadByJobId } from "@/lib/db/surveys";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RetryNotionButton } from "@/components/survey/RetryNotionButton";

export const dynamic = "force-dynamic";

export default async function SubmittedPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId: rawJobId } = await params;
  const jobId = decodeURIComponent(rawJobId);
  const survey = await getSurveyByJobId(jobId);
  const lead = await getLeadByJobId(jobId);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardBody className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <div>
            <h1 className="text-xl font-semibold">Survey submitted</h1>
            <p className="text-sm text-slate-500">
              {lead?.customerName ?? jobId} is now ready for quotation.
            </p>
          </div>

          {survey && !survey.notionPushed && (
            <div className="space-y-3 rounded-lg bg-amber-50 p-3 text-left">
              <p className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                The survey is saved, but the Notion status couldn’t be updated.
                The sales team won’t see it move to “Ready for Quotation” until
                this succeeds.
              </p>
              <RetryNotionButton jobId={jobId} />
            </div>
          )}

          {survey?.notionPushed && (
            <p className="text-sm text-green-700">Notion status updated ✓</p>
          )}

          <div className="space-y-2">
            <Link href={`/jobs/${encodeURIComponent(jobId)}`}>
              <Button className="w-full">Edit survey</Button>
            </Link>
            <Link href="/jobs">
              <Button variant="secondary" className="w-full">
                Back to jobs
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
