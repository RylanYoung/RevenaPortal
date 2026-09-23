import type { LeadType } from "./types";

/**
 * GHL's webhook payloads are not one fixed shape — a workflow trigger, a form
 * submission trigger and an inbound-webhook step all spell the same field
 * differently (`contact_id` vs `contactId`, `postal_code` vs `postcode`), and
 * `tags` arrives as an array from some triggers and a comma-separated string
 * from others. Rather than pin this to one trigger type and silently drop
 * leads when you wire up a second automation, every getter below tries the
 * known spellings in turn.
 *
 * The raw body is always stored on the lead regardless, so anything this
 * misses is still recoverable without re-firing the automation.
 */

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strips case and separators from a key.
 *
 * GHL sends `firstname`, `first_name` and `firstName` depending on how the
 * field was set up — matching exact spellings meant a payload using the plain
 * lowercase form arrived with a blank name. Comparing normalised keys makes
 * all three the same key.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Every scope a contact detail might sit in, keyed by normalised name. */
function scopesOf(payload: Json): Map<string, unknown>[] {
  const scopes: Json[] = [payload];
  for (const nested of ["contact", "customData", "custom_data", "data"]) {
    const value = payload[nested];
    if (isObject(value)) scopes.push(value);
  }
  return scopes.map((scope) => {
    const map = new Map<string, unknown>();
    for (const [k, v] of Object.entries(scope)) map.set(normalizeKey(k), v);
    return map;
  });
}

/** Reads the first key that holds a usable string, searching nested scopes too. */
function pick(payload: Json, keys: string[]): string | null {
  const wanted = keys.map(normalizeKey);

  for (const scope of scopesOf(payload)) {
    for (const key of wanted) {
      const value = scope.get(key);
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
  }
  return null;
}

/** Normalises `tags` whether it arrives as an array or a comma-separated string. */
export function extractTags(payload: Json): string[] {
  for (const scope of scopesOf(payload)) {
    for (const key of ["tags", "tag", "contacttags"]) {
      const value = scope.get(key);
      if (Array.isArray(value)) {
        const tags = value
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.length) return tags;
      }
      if (typeof value === "string" && value.trim()) {
        return value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
  }
  return [];
}

function extractName(payload: Json): string | null {
  const full = pick(payload, ["full_name", "fullName", "name", "contact_name"]);
  if (full) return full;

  const first = pick(payload, ["first_name", "firstName"]);
  const last = pick(payload, ["last_name", "lastName"]);
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined || null;
}

/**
 * AU postcodes are 4 digits; pull them out of anything messier.
 *
 * Falls back to the address when there's no postcode field of its own — a
 * payload carrying "12 Barton Street, Orange NSW 2800" and nothing else has
 * the postcode in it, and leaving it blank loses a field the client filters on.
 * The LAST four-digit group is taken, because a street number can also be four
 * digits and always comes first.
 */
function extractPostcode(payload: Json): string | null {
  const raw = pick(payload, [
    "postal_code",
    "postalCode",
    "postcode",
    "post_code",
    "zip",
    "zip_code",
  ]);

  if (raw) {
    const match = raw.match(/\d{4}/);
    return match ? match[0] : raw.slice(0, 16);
  }

  const address = pick(payload, [
    "address",
    "address1",
    "full_address",
    "street_address",
    "street",
  ]);
  if (!address) return null;

  const all = address.match(/\d{4}/g);
  return all ? all[all.length - 1] : null;
}

/**
 * Lead type comes from an explicit field where GHL sets one, otherwise it is
 * inferred from the tags. Left null when genuinely unknown rather than
 * defaulted to 'residential' — a wrong guess here is worse than a blank,
 * because it shows up as fact on the client's dashboard.
 */
function extractLeadType(payload: Json, tags: string[]): LeadType | null {
  const explicit = pick(payload, ["lead_type", "leadType", "property_type", "type"]);
  const haystack = `${explicit ?? ""} ${tags.join(" ")}`.toLowerCase();

  if (haystack.includes("commercial")) return "commercial";
  if (haystack.includes("residential") || haystack.includes("domestic")) {
    return "residential";
  }
  return null;
}

function extractSource(payload: Json): string | null {
  const direct = pick(payload, [
    "source",
    "lead_source",
    "utm_campaign",
    "campaign",
    "campaign_name",
    "adName",
    "ad_name",
  ]);
  if (direct) return direct;

  // Workflow name is a decent fallback — it usually names the funnel.
  const workflow = payload.workflow;
  if (isObject(workflow) && typeof workflow.name === "string") {
    return workflow.name;
  }
  return null;
}

export type ParsedLead = {
  ghl_contact_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  lead_type: LeadType | null;
  source: string | null;
  ghl_tags: string[];
};

export function parseGhlLead(payload: Json): ParsedLead {
  const ghl_tags = extractTags(payload);

  return {
    ghl_contact_id: pick(payload, [
      "contact_id",
      "contactId",
      "contact_ID",
      "id",
    ]),
    name: extractName(payload),
    email: pick(payload, ["email", "email_address", "emailAddress"]),
    phone: pick(payload, ["phone", "phone_number", "phoneNumber", "mobile"]),
    address: pick(payload, ["address", "address1", "full_address", "street_address", "street"]),
    postcode: extractPostcode(payload),
    lead_type: extractLeadType(payload, ghl_tags),
    source: extractSource(payload),
    ghl_tags,
  };
}

/**
 * Picks the client whose `ghl_tag_reference` appears in the payload's tags.
 *
 * Returns `ambiguous` when the payload carries tags for more than one client.
 * That is deliberately NOT resolved by "first match wins": silently picking
 * one would deliver a lead to a client who didn't buy it and bill their pack
 * for it. Ambiguous leads go to the unassigned queue for a human to place.
 */
export function matchClientByTag(
  tags: string[],
  clients: { id: string; ghl_tag_reference: string | null }[]
): { clientId: string | null; ambiguous: boolean; matchedTag: string | null } {
  const lowerTags = tags.map((t) => t.toLowerCase());

  const matches = clients.filter(
    (c) =>
      c.ghl_tag_reference && lowerTags.includes(c.ghl_tag_reference.toLowerCase())
  );

  if (matches.length === 1) {
    return {
      clientId: matches[0].id,
      ambiguous: false,
      matchedTag: matches[0].ghl_tag_reference,
    };
  }

  return {
    clientId: null,
    ambiguous: matches.length > 1,
    matchedTag: null,
  };
}
