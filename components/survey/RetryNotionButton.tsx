"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryNotionPush } from "@/actions/survey";
import { Button } from "@/components/ui/button";

export function RetryNotionButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    const res = await retryNotionPush(jobId);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="space-y-1">
      <Button variant="secondary" onClick={retry} disabled={busy}>
        {busy ? "Retrying…" : "Retry Notion update"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
