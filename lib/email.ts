import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

let transporter: Transporter | null = null;

/** Lazily build (and reuse) the SMTP transport. Returns null if unconfigured. */
function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for 465, false for 587/STARTTLS
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/**
 * Best-effort notification to the sales team that a survey was submitted.
 * No-ops (returns false) if SMTP or the recipient is not configured, so it
 * never blocks or fails a submission. Returns true if an email was dispatched.
 */
export async function sendSurveySubmittedEmail(input: {
  jobId: string;
  customerName?: string | null;
  address?: string | null;
}): Promise<boolean> {
  const to = env.SALES_NOTIFICATION_EMAIL;
  const from = env.MAIL_FROM ?? env.SMTP_USER;
  const t = getTransporter();

  if (!t || !to || !from) {
    console.warn("[email] SMTP/recipient/from not configured — skipping sales notification");
    return false;
  }

  const customer = input.customerName || "Unknown customer";
  const link = `${env.APP_URL}/sales/${encodeURIComponent(input.jobId)}`;

  const text = [
    `A site survey has been submitted and is ready for quotation.`,
    ``,
    `Customer: ${customer}`,
    `Job ID:   ${input.jobId}`,
    input.address ? `Address:  ${input.address}` : null,
    ``,
    `View the full survey: ${link}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a">
      <h2 style="margin:0 0 8px">Survey submitted — ready for quotation</h2>
      <p style="margin:0 0 16px;color:#475569">A site survey has been submitted by the surveyor.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#64748b">Customer</td><td><strong>${escapeHtml(customer)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#64748b">Job ID</td><td>${escapeHtml(input.jobId)}</td></tr>
        ${input.address ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Address</td><td>${escapeHtml(input.address)}</td></tr>` : ""}
      </table>
      <p style="margin:16px 0 0">
        <a href="${link}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">
          View full survey
        </a>
      </p>
    </div>
  `;

  await t.sendMail({
    from,
    to,
    subject: `Survey ready for quotation — ${customer} (${input.jobId})`,
    text,
    html,
  });
  return true;
}
