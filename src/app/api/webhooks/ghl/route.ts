import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseGhlLead, matchClientByTag } from "@/lib/ghl";

/**
 * POST /api/webhooks/ghl?key=<GHL_WEBHOOK_SECRET>
 *
 * The single intake URL. Paste it into every GHL automation that fires on
 * lead QUALIFICATION (not raw contact creation) — unqualified leads should
 * never reach a client's dashboard or touch their pack.
 *
 * Guarantees, in order of how much they matter:
 *  1. The raw body is stored on every accepted lead, always.
 *  2. A lead is never dropped for being untaggable — it lands in the
 *     unassigned queue instead.
 *  3. A repeat delivery of the same GHL contact never double-counts.
 */

// Explicit: this route uses node:crypto and the service-role key.
export const runtime = "nodejs";

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Hash both sides first so timingSafeEqual gets equal-length buffers
  // regardless of what was submitted.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function authorize(request: NextRequest): boolean {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return false; // Fail closed — an unset secret must not mean "open".

  // Query param is the easiest thing to paste into a GHL webhook step;
  // the headers are there for when you'd rather keep it out of the URL.
  const fromQuery = request.nextUrl.searchParams.get("key");
  const fromHeader = request.headers.get("x-webhook-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return (
    secretMatches(fromQuery, expected) ||
    secretMatches(fromHeader, expected) ||
    secretMatches(bearer ?? null, expected)
  );
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return Response.json(
        { error: "Body must be a JSON object" },
        { status: 400 }
      );
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const lead = parseGhlLead(payload);

  // ---- de-dupe: GHL retries, and automations sometimes double-fire ----
  if (lead.ghl_contact_id) {
    const { data: existing } = await db
      .from("leads")
      .select("id")
      .eq("ghl_contact_id", lead.ghl_contact_id)
      .maybeSingle();

    if (existing) {
      // 200, not an error: from GHL's side this delivery succeeded, and a
      // non-2xx would just make it retry the duplicate again.
      return Response.json({
        status: "duplicate",
        lead_id: existing.id,
        message: "This GHL contact has already been delivered.",
      });
    }
  }

  // ---- route to a client by tag ----
  const { data: clients, error: clientsError } = await db
    .from("clients")
    .select("id, ghl_tag_reference, status")
    .not("ghl_tag_reference", "is", null);

  if (clientsError) {
    return Response.json(
      { error: "Could not load clients", detail: clientsError.message },
      { status: 500 }
    );
  }

  const match = matchClientByTag(lead.ghl_tags, clients ?? []);
  const matchedClient = clients?.find((c) => c.id === match.clientId) ?? null;

  // ---- find the pack this lead should count against ----
  // Only an ACTIVE client with an ACTIVE pack gets one. A lead delivered to a
  // paused client, or to a client between packs, is still stored and still
  // visible — it just isn't billed to a pack until you place it.
  let packId: string | null = null;
  if (matchedClient && matchedClient.status === "active") {
    const { data: pack } = await db
      .from("packs")
      .select("id")
      .eq("client_id", matchedClient.id)
      .eq("status", "active")
      .maybeSingle();
    packId = pack?.id ?? null;
  }

  const { data: inserted, error: insertError } = await db
    .from("leads")
    .insert({
      client_id: match.clientId,
      pack_id: packId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      postcode: lead.postcode,
      lead_type: lead.lead_type,
      source: lead.source,
      ghl_contact_id: lead.ghl_contact_id,
      ghl_tags: lead.ghl_tags,
      raw_payload: payload,
      status: "delivered",
    })
    .select("id")
    .single();

  if (insertError) {
    return Response.json(
      { error: "Could not save lead", detail: insertError.message },
      { status: 500 }
    );
  }

  // ---- audit trail ----
  const reason = match.ambiguous
    ? `Tags matched more than one client (${lead.ghl_tags.join(", ")}) — needs manual assignment`
    : match.clientId
      ? `Matched tag "${match.matchedTag}"`
      : lead.ghl_tags.length
        ? `No client owns any of these tags: ${lead.ghl_tags.join(", ")}`
        : "Payload carried no tags";

  await db.from("lead_events").insert({
    lead_id: inserted.id,
    event_type: match.clientId ? "assigned" : "received",
    new_value: match.clientId ?? "unassigned",
    actor: "system",
    note: reason,
  });

  return Response.json({
    status: match.clientId ? "assigned" : "unassigned",
    lead_id: inserted.id,
    client_id: match.clientId,
    pack_id: packId,
    ambiguous: match.ambiguous,
    message: reason,
  });
}

/** GET is here so you can confirm the URL is live from a browser. */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    status: "ready",
    message: "Revena lead intake is live. Send leads here as POST with a JSON body.",
  });
}
