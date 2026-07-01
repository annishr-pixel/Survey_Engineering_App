import "server-only";

/**
 * Server-side environment access with fail-fast validation.
 * Import only from server code (route handlers, server actions, server components).
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get NOTION_TOKEN() {
    return required("NOTION_TOKEN");
  },
  get NOTION_ENQUIRIES_DB_ID() {
    return required("NOTION_ENQUIRIES_DB_ID");
  },
  get NOTION_CUSTOMER_DETAILS_DB_ID() {
    return required("NOTION_CUSTOMER_DETAILS_DB_ID");
  },
  get NOTION_READY_STATUS_NAME() {
    return process.env.NOTION_READY_STATUS_NAME ?? "Ready for Quotation";
  },
  get BLOB_READ_WRITE_TOKEN() {
    return required("BLOB_READ_WRITE_TOKEN");
  },

  // ---- Email (survey-submitted notification to sales) ----
  // All optional: if SMTP_HOST or SALES_NOTIFICATION_EMAIL is unset, the email
  // step is skipped silently and submission still succeeds.
  get SMTP_HOST() {
    return optional("SMTP_HOST");
  },
  get SMTP_PORT() {
    return Number(process.env.SMTP_PORT ?? 587);
  },
  get SMTP_SECURE() {
    return process.env.SMTP_SECURE === "true";
  },
  get SMTP_USER() {
    return optional("SMTP_USER");
  },
  get SMTP_PASS() {
    return optional("SMTP_PASS");
  },
  get MAIL_FROM() {
    return optional("MAIL_FROM");
  },
  /** Recipient(s) for the sales notification. Comma-separated for multiple. */
  get SALES_NOTIFICATION_EMAIL() {
    return optional("SALES_NOTIFICATION_EMAIL");
  },
  /** Public base URL used to build links in emails. */
  get APP_URL() {
    return optional("APP_URL") ?? optional("AUTH_URL") ?? "http://localhost:3000";
  },

  /** Local folder holding the generated initial-estimation PDFs (by Job ID). */
  get INITIAL_ESTIMATION_FILE_PATH() {
    return optional("INITIAL_ESTIMATION_FILE_PATH");
  },
};
