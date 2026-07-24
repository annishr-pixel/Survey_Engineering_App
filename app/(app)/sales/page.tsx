import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, surveys } from "@/lib/db/schema";
import { ROOF_TYPES, MAIN_FUSE_RATINGS } from "@/lib/validation/survey";
import { Card, CardBody } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { HeroBanner } from "@/components/HeroBanner";

export const dynamic = "force-dynamic";

type Search = { fuse?: string; roof?: string; asbestos?: string };

function yn(v: boolean | null) {
  return v == null ? "—" : v ? "Yes" : "No";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const conds: SQL[] = [eq(surveys.status, "submitted")];
  if (sp.fuse && (MAIN_FUSE_RATINGS as readonly string[]).includes(sp.fuse)) {
    conds.push(eq(surveys.mainFuseRating, sp.fuse as (typeof MAIN_FUSE_RATINGS)[number]));
  }
  if (sp.roof && (ROOF_TYPES as readonly string[]).includes(sp.roof)) {
    conds.push(eq(surveys.roofType, sp.roof as (typeof ROOF_TYPES)[number]));
  }
  if (sp.asbestos === "true") conds.push(eq(surveys.asbestosPresent, true));
  if (sp.asbestos === "false") conds.push(eq(surveys.asbestosPresent, false));

  const rows = await db
    .select({
      jobId: surveys.jobId,
      customerName: leads.customerName,
      address: leads.address,
      viableSystemKw: surveys.viableSystemKw,
      panelQuantity: surveys.panelQuantity,
      mainFuseRating: surveys.mainFuseRating,
      loopedSupply: surveys.loopedSupply,
      asbestosPresent: surveys.asbestosPresent,
      dcCableLengthM: surveys.dcCableLengthM,
      acCableLengthM: surveys.acCableLengthM,
      scaffoldPermitRequired: surveys.scaffoldPermitRequired,
      roofType: surveys.roofType,
      submittedAt: surveys.submittedAt,
    })
    .from(surveys)
    .leftJoin(leads, eq(surveys.jobId, leads.jobId))
    .where(and(...conds))
    .orderBy(desc(surveys.submittedAt));

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Sales Dashboard"
        subtitle="Review completed solar PV surveys and prepare quotations for customers"
      />

      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Sales-Pitch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Submitted surveys ready for quotation ({rows.length}). Review completed projects and prepare proposals.
        </p>
      </div>

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="fuse">Main fuse</Label>
              <Select id="fuse" name="fuse" defaultValue={sp.fuse ?? ""}>
                <option value="">Any</option>
                {MAIN_FUSE_RATINGS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="roof">Roof type</Label>
              <Select id="roof" name="roof" defaultValue={sp.roof ?? ""}>
                <option value="">Any</option>
                {ROOF_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="asbestos">Asbestos</Label>
              <Select id="asbestos" name="asbestos" defaultValue={sp.asbestos ?? ""}>
                <option value="">Any</option>
                <option value="true">Present</option>
                <option value="false">Absent</option>
              </Select>
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Customer", "Job ID", "kW", "Panels", "Fuse", "Looped", "Asbestos", "DC m", "AC m", "Scaffold permit", "Roof", "Submitted", ""].map(
                  (h, i) => (
                    <th key={h || `col-${i}`} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-slate-400">
                    No matching surveys.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.jobId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/sales/${encodeURIComponent(r.jobId)}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {r.customerName ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.jobId}</td>
                    <td className="px-3 py-2">{r.viableSystemKw ?? "—"}</td>
                    <td className="px-3 py-2">{r.panelQuantity ?? "—"}</td>
                    <td className="px-3 py-2">{r.mainFuseRating ?? "—"}</td>
                    <td className="px-3 py-2">{yn(r.loopedSupply)}</td>
                    <td className={`px-3 py-2 ${r.asbestosPresent ? "font-semibold text-red-600" : ""}`}>
                      {yn(r.asbestosPresent)}
                    </td>
                    <td className="px-3 py-2">{r.dcCableLengthM ?? "—"}</td>
                    <td className="px-3 py-2">{r.acCableLengthM ?? "—"}</td>
                    <td className="px-3 py-2">{yn(r.scaffoldPermitRequired)}</td>
                    <td className="px-3 py-2">{r.roofType ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/sales/${encodeURIComponent(r.jobId)}`}
                        className="whitespace-nowrap font-medium text-brand hover:underline"
                      >
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
    </div>
  );
}
