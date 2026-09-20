"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";
import { FLAG_REASONS, OUTCOMES, type FlagReason, type Outcome } from "@/lib/types";

/**
 * Client-side mutations. All of these run through the ANON key, so RLS decides
 * what's reachable and the column grant decides what's writable — this file
 * never needs to check ownership itself.
 */

type Result = { ok: true } | { ok: false; error: string };

/**
 * Raises a replacement request. Note what this does NOT do: set `status`.
 * The database trigger promotes it to 'replacement_requested', which is what
 * keeps a client from ever marking their own lead replaced.
 */
export async function flagLead(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const leadId = String(formData.get("lead_id") ?? "");
  const reason = String(formData.get("flag_reason") ?? "");
  const note = String(formData.get("flag_note") ?? "").trim();

  if (!leadId) return { ok: false, error: "Missing lead." };
  if (!(FLAG_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: "Choose a reason." };
  }

  const db = await supabaseServer();

  const { error } = await db
    .from("leads")
    .update({
      flag_reason: reason as FlagReason,
      flag_note: note || null,
      flagged_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/leads");
  revalidatePath("/portal");
  return { ok: true };
}

/**
 * Saves the client's own CRM fields. Entirely their workspace — none of this
 * touches delivery status or pack counts.
 */
export async function saveCrm(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const leadId = String(formData.get("lead_id") ?? "");
  if (!leadId) return { ok: false, error: "Missing lead." };

  const outcomeRaw = String(formData.get("outcome") ?? "");
  const outcome = (OUTCOMES as readonly string[]).includes(outcomeRaw)
    ? (outcomeRaw as Outcome)
    : null;

  const notes = String(formData.get("crm_notes") ?? "").trim();
  const followUp = String(formData.get("follow_up_date") ?? "").trim();

  const db = await supabaseServer();

  const { error } = await db
    .from("leads")
    .update({
      outcome,
      crm_notes: notes || null,
      follow_up_date: followUp || null,
    })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/leads");
  revalidatePath("/portal");
  return { ok: true };
}
