"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveCustomer, rejectCustomer } from "@/actions/approval";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function ApprovalActions({
  enquiryPageId,
  currentApproval,
  currentReason,
}: {
  enquiryPageId: string;
  currentApproval: string | null;
  currentReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(currentReason ?? "");
  const [error, setError] = useState<string | null>(null);

  const approved = currentApproval === "Y";
  const rejected = currentApproval === "N";

  async function onApprove() {
    setBusy(true);
    setError(null);
    const res = await approveCustomer(enquiryPageId);
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
    const res = await rejectCustomer(enquiryPageId, reason);
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
        <Button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className={approved ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {approved ? "Approved ✓ (Y)" : "Approve (Y)"}
        </Button>
        <Button
          type="button"
          variant={rejected ? "danger" : "secondary"}
          disabled={busy}
          onClick={() => {
            setRejecting((v) => !v);
            setError(null);
          }}
        >
          {rejected ? "Rejected (N)" : "Reject (N)"}
        </Button>
      </div>

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

      {rejected && !rejecting && currentReason && (
        <p className="text-xs text-slate-500">Reason: {currentReason}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
