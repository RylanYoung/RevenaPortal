"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, currentPortalUser } from "@/lib/supabase-server";
import { validate, type Answers } from "@/lib/onboarding";
import type { ServiceType } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Saves the onboarding answers.
 *
 * Runs through the anon key, so RLS confines the write to the caller's own
 * client row and the column grant confines it to the onboarding and contact
 * columns — `ghl_tag_reference` in particular is unreachable, since a client
 * able to set their own routing tag could redirect another client's leads to
 * themselves.
 *
 * @param editingDeliveryOnly true when called from the Account page, where
 *   only the delivery preferences are on screen and the rest must be left
 *   exactly as it was.
 */
export async function saveOnboarding(
  answers: Answers,
  editingDeliveryOnly = false
): Promise<Result> {
  const session = await currentPortalUser();
  if (!session?.client) return { ok: false, error: "You're not logged in." };

  if (!editingDeliveryOnly) {
    const problem = validate(answers);
    if (problem) return { ok: false, error: problem };
  }

  const db = await supabaseServer();

  const patch: Record<string, unknown> = {
    onboarding: answers,
    updated_at: new Date().toISOString(),
  };

  if (!editingDeliveryOnly) {
    patch.onboarding_completed_at = new Date().toISOString();

    // Copy the answers that duplicate real client fields onto the record
    // itself, so there's one source of truth rather than two that drift.
    const str = (k: string) =>
      typeof answers[k] === "string" && (answers[k] as string).trim()
        ? (answers[k] as string).trim()
        : null;

    const business = str("business_name");
    if (business) patch.business_name = business;
    const contact = str("contact_name");
    if (contact) patch.contact_name = contact;
    const phone = str("phone");
    if (phone) patch.phone = phone;
    const email = str("email");
    if (email) patch.email = email;
    const area = str("service_area");
    if (area) patch.region = area;

    const purchased = str("leads_purchased");
    if (purchased && ["residential", "commercial", "both"].includes(purchased)) {
      patch.service_type = purchased as ServiceType;
    }
  }

  const { error } = await db
    .from("clients")
    .update(patch)
    .eq("id", session.client.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal", "layout");

  if (!editingDeliveryOnly) redirect("/portal");
  return { ok: true };
}
