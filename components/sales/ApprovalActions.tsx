"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveCustomer, rejectCustomer, getSurveyors, type Surveyor } from "@/actions/approval";
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
  const [approving, setApproving] = useState(false);
  const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>("");
  const [loadingSurveyors, setLoadingSurveyors] = useState(false);

  const approved = currentApproval === "Y";
  const rejected = currentApproval === "N";

  async function loadSurveyors() {
    setLoadingSurveyors(true);
    try {
      const surveyorList = await getSurveyors();
      setSurveyors(surveyorList);
      if (surveyorList.length > 0) {
        setSelectedSurveyor(surveyorList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load surveyors");
    } finally {
      setLoadingSurveyors(false);
    }
  }

  async function onApprove() {
    if (approving && !selectedSurveyor) {
      setError("Please select a surveyor.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await approveCustomer(enquiryPageId, approving ? selectedSurveyor : undefined);
    if (res.ok) {
      setApproving(false);
      router.refresh();
    } else {
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
          onClick={() => {
            if (!approving) {
              setApproving(true);
              loadSurveyors();
            }
          }}
          disabled={busy || approved}
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
            setApproving(false);
            setError(null);
          }}
        >
          {rejected ? "Rejected (N)" : "Reject (N)"}
        </Button>
      </div>

      {approving && !approved && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <label className="block text-sm font-medium text-slate-700">
            Assign Surveyor
          </label>
          {loadingSurveyors ? (
            <p className="text-sm text-slate-500">Loading surveyors…</p>
          ) : surveyors.length === 0 ? (
            <p className="text-sm text-slate-500">No surveyors available</p>
          ) : (
            <select
              value={selectedSurveyor}
              onChange={(e) => setSelectedSurveyor(e.target.value)}
              disabled={busy}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {surveyors.map((surveyor) => (
                <option key={surveyor.id} value={surveyor.id}>
                  {surveyor.name || surveyor.email}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onApprove}
              disabled={busy || !selectedSurveyor || loadingSurveyors}
            >
              {busy ? "Approving…" : "Confirm Approval"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setApproving(false);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
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

      {rejected && !rejecting && currentReason && (
        <p className="text-xs text-slate-500">Reason: {currentReason}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
