/**
 * Defensive extractors for Notion page property values. Notion properties are
 * frequently empty or null on real data, so every helper returns null safely.
 *
 * Verified property types (2026-07-23, run scripts/notion-diagnose.ts to re-check):
 *   Enquiries:        Customer Name=title, Email=rich_text, Phone No=phone_number,
 *                     Job ID=rich_text, Status=select, Client Approval=select,
 *                     Service Interested=multi_select, Initial Estimation Amount=number
 *   Customer Details: Customer Name=title, Customer Address=rich_text, Phone No=phone_number,
 *                     Job ID=rich_text, Email=email, Domestic/Commercial=rich_text,
 *                     Annual Energy Consumption=rich_text, Status=select,
 *                     *(Y/N)=select (Yes/No), EV/ASHP...=select
 *
 * Column names are defined centrally in ./fields.ts — do not hard-code them.
 */

// The SDK's property union is wide; we narrow at runtime by `.type`.
type Props = Record<string, any>;

function plainText(rich: any[] | undefined): string | null {
  if (!rich || rich.length === 0) return null;
  const text = rich.map((r) => r.plain_text ?? "").join("").trim();
  return text || null;
}

export function getTitle(props: Props, name: string): string | null {
  const p = props[name];
  if (p?.type !== "title") return null;
  return plainText(p.title);
}

export function getRichText(props: Props, name: string): string | null {
  const p = props[name];
  if (p?.type !== "rich_text") return null;
  return plainText(p.rich_text);
}

/** Reads either rich_text or title — tolerates schema drift on text-ish fields. */
export function getText(props: Props, name: string): string | null {
  return getRichText(props, name) ?? getTitle(props, name);
}

export function getEmail(props: Props, name: string): string | null {
  const p = props[name];
  if (p?.type === "email") return p.email ?? null;
  return getText(props, name);
}

export function getPhone(props: Props, name: string): string | null {
  const p = props[name];
  if (p?.type === "phone_number") return p.phone_number ?? null;
  if (p?.type === "number") return p.number != null ? String(p.number) : null;
  return getText(props, name);
}

export function getNumber(props: Props, name: string): number | null {
  const p = props[name];
  if (p?.type === "number") return p.number ?? null;
  return null;
}

export function getSelect(props: Props, name: string): string | null {
  const p = props[name];
  if (p?.type === "select") return p.select?.name ?? null;
  return null;
}

export function getMultiSelect(props: Props, name: string): string[] {
  const p = props[name];
  if (p?.type !== "multi_select") return [];
  return (p.multi_select ?? []).map((o: any) => o.name);
}

/**
 * Reads a select value, falling back to rich_text/title. Use for fields that
 * may be a select in one database version and free text in another (e.g. the
 * Y/N fields and Status, which are now selects on the live databases).
 */
export function getSelectOrText(props: Props, name: string): string | null {
  return getSelect(props, name) ?? getText(props, name);
}

/**
 * Best-effort string for ANY property type — used by the PDF export, which just
 * needs a human-readable value regardless of the underlying Notion type.
 */
export function getAnyText(props: Props, name: string): string | null {
  const p = props[name];
  if (!p) return null;
  switch (p.type) {
    case "title":
      return plainText(p.title);
    case "rich_text":
      return plainText(p.rich_text);
    case "select":
      return p.select?.name ?? null;
    case "multi_select":
      return (p.multi_select ?? []).map((o: any) => o.name).join(", ") || null;
    case "email":
      return p.email ?? null;
    case "phone_number":
      return p.phone_number ?? null;
    case "number":
      return p.number != null ? String(p.number) : null;
    case "date":
      return p.date?.start ?? null;
    case "checkbox":
      return p.checkbox ? "Yes" : "No";
    case "url":
      return p.url ?? null;
    default:
      return null;
  }
}

/** Parses free-text Y/N fields into a boolean (null when blank/ambiguous). */
export function parseYesNo(value: string | null): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(v)) return true;
  if (["n", "no", "false", "0"].includes(v)) return false;
  return null;
}

/** Maps the free-text "Domestic/Commercial" field to our enum. */
export function parsePropertyUse(
  value: string | null,
): "domestic" | "commercial" | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith("dom") || v.startsWith("res")) return "domestic";
  if (v.startsWith("com")) return "commercial";
  return null;
}
