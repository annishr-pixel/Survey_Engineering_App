"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import { approveFinalQuotation, rejectFinalQuotation } from "@/actions/approval";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function FinalQuotationActions({
  customerDetailsPageId,
  jobId,
  status,
  surveySubmitted,
}: {
  customerDetailsPageId: string;
  jobId: string | null;
  status: string | null;
  /** True once the survey engineer has submitted the site survey for this job. */
  surveySubmitted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const s = (status ?? "").toLowerCase();
  const approved = s.startsWith("approved for final quotation");
  const rejected = s.startsWith("rejected for final quotation");
  const pending = !approved && !rejected;

  async function onApprove() {
    setBusy(true);
    setError(null);
    const res = await approveFinalQuotation(customerDetailsPageId, jobId);
    if (res.ok) router.refresh();
    else {
      setError(res.error);
      setBusy(false);
    }
  }

  async function onReject() {
    if (!reason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await rejectFinalQuotation(customerDetailsPageId, jobId, reason);
    if (res.ok) {
      setRejecting(false);
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {pending && (
          <>
            <Button type="button" onClick={onApprove} disabled={busy}>
              Approve (Y)
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setRejecting((v) => !v);
                setError(null);
              }}
            >
              Reject (N)
            </Button>
          </>
        )}

        {surveySubmitted && jobId && (
          <a href={`/api/final-quotation/${encodeURIComponent(jobId)}`}>
            <Button type="button">
              <FileDown className="h-4 w-4" /> Download details (PDF)
            </Button>
          </a>
        )}
      </div>

      {!surveySubmitted && (
        <p className="text-xs text-slate-400">
          Download available once the survey engineer submits the site survey.
        </p>
      )}

      {rejecting && (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)…"
            rows={2}
          />
          <div className="flex gap-2">
            <Button type="button" variant="danger" onClick={onReject} disabled={busy}>
              {busy ? "Saving…" : "Confirm rejection"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
