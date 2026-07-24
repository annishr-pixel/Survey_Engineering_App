import Link from "next/link";
import { queryEstimatesForApproval } from "@/lib/notion/sync";
import { Card, CardBody } from "@/components/ui/card";
import { ApprovalActions } from "@/components/sales/ApprovalActions";
import { Button } from "@/components/ui/button";
import { HeroBanner } from "@/components/HeroBanner";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function approvalBadge(a: string | null) {
  if (a === "Y") return "bg-green-100 text-green-800";
  if (a === "N") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

export default async function SurveyApprovalsPage() {
  let rows: Awaited<ReturnType<typeof queryEstimatesForApproval>> = [];
  let loadError: string | null = null;
  try {
    rows = await queryEstimatesForApproval();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load enquiries from Notion.";
  }

  const pending = rows.filter((r) => r.customerApproval !== "Y" && r.customerApproval !== "N").length;

  return (
    <div className="space-y-5">
      <div className="mb-4">
        <Link href="/sales" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <HeroBanner
        title="Survey Approvals"
        subtitle="Review and approve customer surveys. Assign surveyors to approved jobs."
        imageUrl="https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=400&fit=crop"
        imageAlt="Solar Panel Installation"
      />

      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <p className="text-sm text-slate-700">
          <strong>Total Enquiries:</strong> {rows.length} ·
          <strong className="ml-4">Awaiting Approval:</strong> {pending}
        </p>
      </div>

      {loadError ? (
        <Card>
          <CardBody className="text-center text-red-600">{loadError}</CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500">
            No enquiries awaiting survey approval.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.enquiryPageId}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{r.customerName ?? "Unknown customer"}</p>
                      <p className="text-xs text-slate-500">{r.jobId ?? "—"}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>
                          Initial estimate:{" "}
                          <strong>
                            {r.initialEstimatedAmount != null
                              ? `£${r.initialEstimatedAmount.toLocaleString("en-GB")}`
                              : "—"}
                          </strong>
                        </span>
                        {r.serviceInterested.length > 0 && (
                          <span>{r.serviceInterested.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${approvalBadge(r.customerApproval)}`}
                    >
                      {r.customerApproval === "Y"
                        ? "Approved"
                        : r.customerApproval === "N"
                          ? "Rejected"
                          : "Awaiting approval"}
                    </span>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <ApprovalActions
                      enquiryPageId={r.enquiryPageId}
                      currentApproval={r.customerApproval}
                      currentReason={r.reasonForRejection}
                    />
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
