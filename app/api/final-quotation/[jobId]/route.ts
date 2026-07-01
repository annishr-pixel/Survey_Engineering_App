import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { auth } from "@/lib/auth";
import { getCustomerDetailsByJobId } from "@/lib/notion/sync";
import { getSurveyByJobId } from "@/lib/db/surveys";
import { SECTIONS, type FieldDef } from "@/lib/survey-sections";
import type { Survey } from "@/lib/db/schema";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * pdf-lib's standard fonts use WinAnsi (CP1252) encoding, which cannot encode
 * characters like ≤ ≥ → or exotic unicode. Map common symbols to ASCII and
 * strip anything outside the printable Latin-1 range so drawText never throws.
 */
function pdfSafe(text: unknown): string {
  return String(text ?? "")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    // keep printable ASCII (0x20-0x7E) + Latin-1 supplement (0xA0-0xFF);
    // drop DEL + C1 range (0x7F-0x9F), which have undefined WinAnsi glyphs.
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/** Read a survey field for display (mirrors the sales detail view). */
function surveyValue(field: FieldDef, survey: Survey): string {
  let raw: unknown;
  if (field.name.startsWith("extras.")) {
    const extras = (survey.extras ?? {}) as Record<string, string>;
    raw = extras[field.name.slice("extras.".length)];
  } else {
    raw = (survey as Record<string, unknown>)[field.name];
  }
  if (raw == null || raw === "") return "—";
  if (field.type === "bool") return raw === true ? "Yes" : raw === false ? "No" : "—";
  if (field.type === "multi") {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.length ? arr.map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v)).join(", ") : "—";
  }
  if (field.type === "enum") return field.options?.find((o) => o.value === raw)?.label ?? String(raw);
  return String(raw);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || session.user.role !== "sales") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId: raw } = await params;
  const jobId = decodeURIComponent(raw);

  try {
    const details = await getCustomerDetailsByJobId(jobId);
    if (!details) {
      await logEvent("warn", "final_quotation.pdf.not_found", { jobId });
      return NextResponse.json({ error: "No Customer Details found for this job" }, { status: 404 });
    }
    const survey = await getSurveyByJobId(jobId);

    // ---- Build the PDF ----
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const A4: [number, number] = [595.28, 841.89];
    const margin = 48;
    const size = 10;
    const lh = 15;
    let page: PDFPage = doc.addPage(A4);
    let y = A4[1] - margin;

    const newPageIfNeeded = () => {
      if (y < margin + lh) {
        page = doc.addPage(A4);
        y = A4[1] - margin;
      }
    };
    const wrap = (text: string, f: PDFFont, fSize: number, maxW: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (f.widthOfTextAtSize(trial, fSize) > maxW && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = trial;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    };
    const heading = (text: string) => {
      newPageIfNeeded();
      y -= 6;
      page.drawText(pdfSafe(text), { x: margin, y, size: 13, font: bold, color: rgb(0.05, 0.46, 0.43) });
      y -= lh + 2;
    };
    const kv = (rawLabel: string, rawValue: string) => {
      const label = pdfSafe(rawLabel);
      const value = pdfSafe(rawValue) || "-";
      const labelW = 190;
      const valLines = wrap(value, font, size, A4[0] - margin * 2 - labelW);
      newPageIfNeeded();
      page.drawText(label, { x: margin, y, size, font: bold, color: rgb(0.28, 0.33, 0.4) });
      valLines.forEach((ln, i) => {
        if (i > 0) {
          y -= lh;
          newPageIfNeeded();
        }
        page.drawText(ln, { x: margin + labelW, y, size, font, color: rgb(0.06, 0.09, 0.16) });
      });
      y -= lh;
    };

    // Title
    page.drawText(pdfSafe("Final Quotation - Job Details"), { x: margin, y, size: 18, font: bold, color: rgb(0.06, 0.09, 0.16) });
    y -= 22;
    page.drawText(pdfSafe(`${details.fields["Customer Name"] || "Unknown"}  -  Job ${jobId}`), {
      x: margin, y, size: 11, font, color: rgb(0.4, 0.45, 0.5),
    });
    y -= lh + 6;

    // Customer Details
    heading("Customer Details");
    for (const [k, v] of Object.entries(details.fields)) {
      if (k === "Customer Name" || k === "Job ID") continue;
      kv(k, v);
    }

    // Survey data
    heading("Survey");
    if (!survey) {
      kv("Survey", "No survey record found for this job.");
    } else {
      kv("Status", survey.status);
      kv("Submitted", survey.submittedAt ? new Date(survey.submittedAt).toISOString() : "—");
      for (const section of SECTIONS) {
        heading(`${section.id} ${section.title}`);
        for (const field of section.fields) kv(field.label, surveyValue(field, survey));
      }
    }

    const bytes = await doc.save();
    await logEvent("info", "final_quotation.pdf.generated", { jobId, hasSurvey: !!survey });

    const safeName = `Final_Quotation_${jobId}`.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (e) {
    await logEvent("error", "final_quotation.pdf.error", { jobId, error: e });
    const message = e instanceof Error ? e.message : "Failed to build PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
