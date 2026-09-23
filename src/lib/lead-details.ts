import type { Lead } from "./types";

/**
 * Everything GHL sent that isn't already on the face of the lead card.
 *
 * The full webhook body has always been stored on the lead, but nothing ever
 * displayed it — so a quiz answer like "bill size" or "roof type" arrived,
 * sat in the database, and was invisible to both sides. This surfaces it.
 *
 * Nothing here parses or renames values: whatever GHL called a field is what
 * gets shown, so a new question added to a funnel appears without any code
 * change.
 */

/** Already shown on the card, or plumbing nobody needs to read. */
const SKIP = new Set([
  "contact_id",
  "contactid",
  "id",
  "first_name",
  "firstname",
  "last_name",
  "lastname",
  "full_name",
  "fullname",
  "name",
  "contact_name",
  "email",
  "email_address",
  "emailaddress",
  "phone",
  "phone_number",
  "phonenumber",
  "mobile",
  "address",
  "address1",
  "full_address",
  "street_address",
  "street",
  "postal_code",
  "postalcode",
  "postcode",
  "post_code",
  "zip",
  "zip_code",
  // Not shown by request — it comes through in the payload and is still
  // stored on the lead, it just isn't surfaced.
  "homeowner",
  "homeownerstatus",
  "homeowner_status",
  "tags",
  "tag",
  "contact_tags",
  "location",
  "location_id",
  "locationid",
  "workflow",
  "customdata",
  "custom_data",
  "contact",
  "data",
  "webhookid",
  "webhook_id",
  "timestamp",
  "date_created",
  "datecreated",
]);

export type Detail = { label: string; value: string };

/** "roof_type" and "roofType" both become "Roof type". */
function prettyLabel(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function readable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : null;
  }
  if (Array.isArray(value)) {
    const parts = value.map(readable).filter(Boolean) as string[];
    return parts.length ? parts.join(", ") : null;
  }
  return null; // Nested objects are walked separately, not stringified.
}

export function extraDetails(lead: Lead): Detail[] {
  const payload = lead.raw_payload;
  if (!payload || typeof payload !== "object") return [];

  const out: Detail[] = [];
  const seen = new Set<string>();

  const walk = (obj: Record<string, unknown>, depth: number) => {
    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();

      // GHL nests custom fields under customData; those are exactly the
      // answers worth showing, so descend rather than skip.
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        depth < 2
      ) {
        walk(value as Record<string, unknown>, depth + 1);
        continue;
      }

      if (SKIP.has(lower)) continue;

      const text = readable(value);
      if (!text) continue;

      const label = prettyLabel(key);
      const dedupe = `${label}|${text}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      out.push({ label, value: text });
    }
  };

  walk(payload as Record<string, unknown>, 0);

  return out.sort((a, b) => a.label.localeCompare(b.label));
}
