import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { Card, CardBody } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Search = { period?: string; status?: string; detail?: string };

const PERIODS = [
  { value: "yesterday", label: "Yesterday" },
  { value: "daily", label: "Daily" },
  { value: "twice-weekly", label: "Twice weekly" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const STATUSES = [
  { value: "all", label: "All customers" },
  { value: "approved", label: "Approved (Y)" },
  { value: "rejected", label: "Rejected (N)" },
  { value: "pending", label: "Awaiting approval" },
  { value: "submitted", label: "Survey submitted" },
] as const;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function mondayOf(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function bucketFor(date: Date, period: string): { key: string; label: string; sort: number } {
  const d = new Date(date);
  if (period === "monthly") {
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    return { key: `m${s.getTime()}`, label: s.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), sort: s.getTime() };
  }
  if (period === "weekly") {
    const m = mondayOf(d);
    return { key: `w${m.getTime()}`, label: `Week of ${m.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, sort: m.getTime() };
  }
  if (period === "twice-weekly") {
    const m = mondayOf(d);
    const idx = Math.floor((startOfDay(d).getTime() - m.getTime()) / 86_400_000);
    const half = idx < 4 ? "1st half" : "2nd half";
    return { key: `t${m.getTime()}-${half}`, label: `Wk ${m.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${half}`, sort: m.getTime() + (idx < 4 ? 0 : 1) };
  }
  const s = startOfDay(d);
  return { key: `d${s.getTime()}`, label: s.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }), sort: s.getTime() };
}

function Kpi({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

function statusLabel(r: { customerApproval: string | null; surveyStatus: string | null }) {
  if (r.customerApproval === "Y") return "Approved";
  if (r.customerApproval === "N") return "Rejected";
  return "Awaiting";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.value === sp.period) ? (sp.period as string) : "daily";
  const status = STATUSES.some((s) => s.value === sp.status) ? (sp.status as string) : "all";
  const detailKey = sp.detail;

  const all = await db
    .select({
      jobId: leads.jobId,
      customerName: leads.customerName,
      customerApproval: leads.customerApproval,
      notionStatus: leads.notionStatus,
      estimate: leads.initialEstimatedAmount,
      syncedAt: leads.syncedAt,
      surveyStatus: surveys.status,
      submittedAt: surveys.submittedAt,
    })
    .from(leads)
    .leftJoin(surveys, eq(leads.jobId, surveys.jobId))
    .orderBy(desc(leads.syncedAt));

  const matchStatus = (r: (typeof all)[number]) => {
    switch (status) {
      case "approved": return r.customerApproval === "Y";
      case "rejected": return r.customerApproval === "N";
      case "pending": return r.customerApproval !== "Y" && r.customerApproval !== "N";
      case "submitted": return r.surveyStatus === "submitted";
      default: return true;
    }
  };

  // "Yesterday" restricts to records registered yesterday, grouped by day.
  const effectivePeriod = period === "yesterday" ? "daily" : period;
  let scoped = all.filter(matchStatus);
  if (period === "yesterday") {
    const todayStart = startOfDay(new Date());
    const yStart = new Date(todayStart);
    yStart.setDate(todayStart.getDate() - 1);
    scoped = scoped.filter((r) => {
      const t = new Date(r.syncedAt).getTime();
      return t >= yStart.getTime() && t < todayStart.getTime();
    });
  }

  const kpis = {
    total: scoped.length,
    approved: scoped.filter((r) => r.customerApproval === "Y").length,
    rejected: scoped.filter((r) => r.customerApproval === "N").length,
    pending: scoped.filter((r) => r.customerApproval !== "Y" && r.customerApproval !== "N").length,
    submitted: scoped.filter((r) => r.surveyStatus === "submitted").length,
    value: scoped.reduce((sum, r) => sum + (r.estimate ? Number(r.estimate) : 0), 0),
  };

  const buckets = new Map<string, { key: string; label: string; sort: number; count: number; approved: number; rejected: number; submitted: number; value: number }>();
  for (const r of scoped) {
    const b = bucketFor(new Date(r.syncedAt), effectivePeriod);
    const cur = buckets.get(b.key) ?? { key: b.key, label: b.label, sort: b.sort, count: 0, approved: 0, rejected: 0, submitted: 0, value: 0 };
    cur.count += 1;
    if (r.customerApproval === "Y") cur.approved += 1;
    if (r.customerApproval === "N") cur.rejected += 1;
    if (r.surveyStatus === "submitted") cur.submitted += 1;
    cur.value += r.estimate ? Number(r.estimate) : 0;
    buckets.set(b.key, cur);
  }
  const grouped = [...buckets.values()].sort((a, b) => b.sort - a.sort);
  const maxCount = Math.max(1, ...grouped.map((g) => g.count));
  const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

  // Drill-down: individual records in the clicked bucket.
  const detailRows = detailKey
    ? scoped.filter((r) => bucketFor(new Date(r.syncedAt), effectivePeriod).key === detailKey)
    : [];
  const detailLabel = grouped.find((g) => g.key === detailKey)?.label;
  const detailHref = (key: string) =>
    `/sales/reports?period=${period}&status=${status}&detail=${encodeURIComponent(key)}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-slate-500">
          Pipeline activity grouped by period, filterable by customer status. Click a period row to
          see the customers registered in it.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="period">View</Label>
              <Select id="period" name="period" defaultValue={period}>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Customer status</Label>
              <Select id="status" name="status" defaultValue={status}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardBody>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Customers" value={String(kpis.total)} />
        <Kpi label="Approved" value={String(kpis.approved)} tone="text-green-700" />
        <Kpi label="Rejected" value={String(kpis.rejected)} tone="text-red-600" />
        <Kpi label="Awaiting" value={String(kpis.pending)} tone="text-amber-700" />
        <Kpi label="Surveys done" value={String(kpis.submitted)} />
        <Kpi label="Est. value" value={gbp(kpis.value)} />
      </div>

      {/* Per-period breakdown */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Period", "Volume", "Customers", "Approved", "Rejected", "Surveys", "Est. value", ""].map((h, i) => (
                  <th key={h || `c${i}`} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">No data for this filter.</td>
                </tr>
              ) : (
                grouped.map((g) => (
                  <tr
                    key={g.key}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${g.key === detailKey ? "bg-brand/5" : ""}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      <Link href={detailHref(g.key)} className="text-brand hover:underline">{g.label}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2 rounded bg-brand" style={{ width: `${Math.max(6, (g.count / maxCount) * 100)}%` }} />
                    </td>
                    <td className="px-3 py-2">{g.count}</td>
                    <td className="px-3 py-2 text-green-700">{g.approved}</td>
                    <td className="px-3 py-2 text-red-600">{g.rejected}</td>
                    <td className="px-3 py-2">{g.submitted}</td>
                    <td className="px-3 py-2">{gbp(g.value)}</td>
                    <td className="px-3 py-2">
                      <Link href={detailHref(g.key)} className="whitespace-nowrap font-medium text-brand hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drill-down detail */}
      {detailKey && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {detailRows.length} customer{detailRows.length === 1 ? "" : "s"} · {detailLabel ?? "Selected period"}
              </h2>
              <Link href={`/sales/reports?period=${period}&status=${status}`} className="text-sm text-slate-500 hover:underline">
                Clear
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Customer", "Job ID", "Approval", "Survey", "Est.", "Registered"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No records.</td></tr>
                  ) : (
                    detailRows.map((r) => (
                      <tr key={r.jobId} className="border-b border-slate-100">
                        <td className="px-3 py-2">{r.customerName ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.jobId}</td>
                        <td className="px-3 py-2">{statusLabel(r)}</td>
                        <td className="px-3 py-2">{r.surveyStatus ?? "—"}</td>
                        <td className="px-3 py-2">{r.estimate ? gbp(Number(r.estimate)) : "—"}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(r.syncedAt).toLocaleString("en-GB")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-slate-400">
        View: <strong>{PERIODS.find((p) => p.value === period)?.label}</strong> · status:{" "}
        <strong>{STATUSES.find((s) => s.value === status)?.label}</strong>. Dates based on when each
        lead entered the system.
      </p>
    </div>
  );
}
