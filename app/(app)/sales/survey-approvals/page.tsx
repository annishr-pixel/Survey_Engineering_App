import { queryEstimatesForApproval } from "@/lib/notion/sync";
import { Card, CardBody } from "@/components/ui/card";
import { ApprovalActions } from "@/components/sales/ApprovalActions";

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
      <div>
        <h1 className="text-xl font-semibold">Survey approvals</h1>
        <p className="text-sm text-slate-500">
          Customers awaiting the go-ahead. Once approved (Y), the job becomes visible to the
          surveyor; if rejected (N), it is marked rejected with a reason. {rows.length} shown
          {pending > 0 ? ` · ${pending} awaiting approval` : ""}.
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
