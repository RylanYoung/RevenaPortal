import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { OUTCOMES, type Outcome } from "@/lib/types";

/**
 * POST /api/webhooks/ghl/update?key=<GHL_WEBHOOK_SECRET>
 *
 * Lets setters and the AI agent write progress back onto a lead as they work
 * it — outcome, a note, a follow-up date.
 *
 * Deliberately limited to the CRM layer. It cannot touch `status`, `pack_id`
 * or `client_id`, so an automation misfiring can never change what a client
 * owes or move a lead between businesses. Same guarantee the portal gives a
 * logged-in client, enforced here in code rather than by a grant because this
 * runs through the service-role key.
 */

export const runtime = "nodejs";

function matches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function authorize(request: NextRequest): boolean {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return false; // Fail closed.

  return (
    matches(request.nextUrl.searchParams.get("key"), expected) ||
    matches(request.headers.get("x-webhook-secret"), expected) ||
    matches(
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      expected
    )
  );
}

/**
 * Maps whatever a setter or agent sends onto our outcomes.
 *
 * Automations rarely send the exact enum value — "appointment set", "booked in",
 * "no answer" are what actually arrive. An unrecognised value leaves the outcome
 * untouched rather than guessing, since a wrong outcome is worse than none.
 */
function normaliseOutcome(raw: string | null): Outcome | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if ((OUTCOMES as readonly string[]).includes(v)) return v as Outcome;

  if (/appoint|booked|scheduled|set/.test(v)) return "booked";
  if (/quote|estimate|proposal/.test(v)) return "quoted";
  if (/won|sold|closed_won|signed/.test(v)) return "won";
  if (/lost|closed_lost|dead|not_interested/.test(v)) return "lost";
  if (/no_answer|noanswer|unreachable|voicemail|no_response/.test(v)) {
    return "no_response";
  }
  if (/contact|spoke|called|answered/.test(v)) return "contacted";

  return null;
}

function str(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Find the lead. contact_id is the natural key — GHL always has it, and it's
  // what the intake webhook stored.
  const contactId = str(payload, ["contact_id", "contactId", "id"]);
  const leadId = str(payload, ["lead_id", "leadId"]);

  if (!contactId && !leadId) {
    return Response.json(
      { error: "Send contact_id (or lead_id) so we know which lead to update." },
      { status: 400 }
    );
  }

  const query = db.from("leads").select("id, crm_notes, outcome, client_id");
  const { data: lead } = leadId
    ? await query.eq("id", leadId).maybeSingle()
    : await query.eq("ghl_contact_id", contactId!).maybeSingle();

  if (!lead) {
    return Response.json(
      {
        status: "not_found",
        message:
          "No lead matches that contact. It may not have been delivered through the portal.",
      },
      { status: 404 }
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changed: string[] = [];

  const outcome = normaliseOutcome(str(payload, ["outcome", "status", "stage", "disposition"]));
  if (outcome && outcome !== lead.outcome) {
    patch.outcome = outcome;
    changed.push(`outcome → ${outcome}`);
  }

  const followUp = str(payload, ["follow_up_date", "followUpDate", "follow_up", "appointment_date"]);
  if (followUp) {
    // Accept a date or a full timestamp; the column is a date.
    const d = new Date(followUp);
    if (!Number.isNaN(d.getTime())) {
      patch.follow_up_date = d.toISOString().slice(0, 10);
      changed.push("follow-up date");
    }
  }

  const note = str(payload, ["note", "notes", "comment", "message"]);
  if (note) {
    // APPEND, never replace. Each call is one moment in a conversation, and
    // overwriting would erase everything said before it — including anything
    // the client typed themselves.
    const who = str(payload, ["actor", "user", "agent", "assigned_to"]) ?? "Revena team";
    const stamp = new Date().toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    const entry = `[${stamp} · ${who}] ${note}`;
    patch.crm_notes = lead.crm_notes ? `${lead.crm_notes}\n\n${entry}` : entry;
    changed.push("note added");
  }

  if (changed.length === 0) {
    return Response.json({
      status: "no_change",
      lead_id: lead.id,
      message: "Nothing recognised to update. Send outcome, note or follow_up_date.",
    });
  }

  const { error } = await db.from("leads").update(patch).eq("id", lead.id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await db.from("lead_events").insert({
    lead_id: lead.id,
    event_type: "crm_updated",
    old_value: lead.outcome,
    new_value: (patch.outcome as string) ?? lead.outcome,
    actor: str(payload, ["actor", "user", "agent"]) ?? "automation",
    note: note ?? null,
  });

  return Response.json({
    status: "updated",
    lead_id: lead.id,
    changed,
  });
}

/** Confirms the endpoint is live and the key works. */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    status: "ready",
    message:
      "Send POST with contact_id plus any of: outcome, note, follow_up_date, actor.",
    outcomes: OUTCOMES,
  });
}
