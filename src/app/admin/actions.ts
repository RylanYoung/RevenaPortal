"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ClientStatus, ServiceType } from "@/lib/types";

/**
 * Every admin mutation lives here. These all run through the service-role
 * client, which is the only thing permitted to move a lead's delivery status
 * or attach it to a pack.
 */

type Result = { ok: true } | { ok: false; error: string };

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

// ---------------------------------------------------------------- clients

export async function createClient(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const business_name = str(formData, "business_name");
  if (!business_name) return { ok: false, error: "Business name is required." };

  const db = supabaseAdmin();
  const postcodesRaw = str(formData, "postcodes");

  const { data: client, error } = await db
    .from("clients")
    .insert({
      business_name,
      contact_name: str(formData, "contact_name"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      service_type: (str(formData, "service_type") ?? "both") as ServiceType,
      region: str(formData, "region"),
      postcodes: postcodesRaw
        ? postcodesRaw.split(",").map((p) => p.trim()).filter(Boolean)
        : [],
      ghl_tag_reference: str(formData, "ghl_tag_reference"),
      notes: str(formData, "notes"),
    })
    .select("id")
    .single();

  if (error) {
    // The unique index on lower(ghl_tag_reference) is the likely culprit, and
    // the raw Postgres message won't mean anything to a human.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Another client already uses that GHL tag. Tags must be unique or leads can't be routed.",
      };
    }
    return { ok: false, error: error.message };
  }

  // An opening pack is optional — you might add the client before they buy.
  const packSize = Number(str(formData, "pack_size") ?? 0);
  if (packSize > 0) {
    const { error: packError } = await db.from("packs").insert({
      client_id: client.id,
      size: packSize,
      price: Number(str(formData, "pack_price") ?? 0),
      started_at: str(formData, "pack_start") ?? new Date().toISOString().slice(0, 10),
    });
    if (packError) {
      return {
        ok: false,
        error: `Client created, but the pack failed: ${packError.message}`,
      };
    }
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return { ok: true };
}

export async function setClientStatus(clientId: string, status: ClientStatus) {
  const db = supabaseAdmin();
  await db
    .from("clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clientId);

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
}

// ------------------------------------------------------------------ packs

export async function createPack(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const client_id = str(formData, "client_id");
  const size = Number(str(formData, "size") ?? 0);
  if (!client_id) return { ok: false, error: "Missing client." };
  if (!size || size < 1) return { ok: false, error: "Pack size must be at least 1." };

  const db = supabaseAdmin();

  // Only one pack per client may be active, so starting a new one closes the
  // old one out. Without this the partial unique index would reject the insert
  // with an error that wouldn't explain itself.
  const { error: closeError } = await db
    .from("packs")
    .update({ status: "completed", ended_at: new Date().toISOString().slice(0, 10) })
    .eq("client_id", client_id)
    .eq("status", "active");

  if (closeError) return { ok: false, error: closeError.message };

  const { error } = await db.from("packs").insert({
    client_id,
    size,
    price: Number(str(formData, "price") ?? 0),
    started_at: str(formData, "started_at") ?? new Date().toISOString().slice(0, 10),
    notes: str(formData, "notes"),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${client_id}`);
  revalidatePath("/admin");
  return { ok: true };
}

// ------------------------------------------------------------------ leads

/**
 * Places a lead with a client — used from the unassigned queue when GHL
 * tagging misfires, and to correct a mis-routed lead.
 */
export async function assignLead(leadId: string, clientId: string) {
  const db = supabaseAdmin();

  const { data: before } = await db
    .from("leads")
    .select("client_id")
    .eq("id", leadId)
    .single();

  // Attach it to whatever pack that client currently has open, so it starts
  // counting from the moment it's placed.
  const { data: pack } = await db
    .from("packs")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  await db
    .from("leads")
    .update({
      client_id: clientId,
      pack_id: pack?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  await db.from("lead_events").insert({
    lead_id: leadId,
    event_type: before?.client_id ? "reassigned" : "assigned",
    old_value: before?.client_id ?? "unassigned",
    new_value: clientId,
    actor: "admin",
    note: pack ? null : "Client has no active pack — lead is not counting against one.",
  });

  revalidatePath("/admin/unassigned");
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin");
}

// ---------------------------------------------------------- portal logins

/**
 * Grants a client access to the portal.
 *
 * Two steps that both have to happen: a Supabase Auth user must exist, and a
 * `portal_users` row must link it to this client. Without the second, they can
 * log in but RLS resolves them to no client and they see nothing.
 */
export async function invitePortalUser(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const client_id = str(formData, "client_id");
  const email = str(formData, "email")?.toLowerCase() ?? null;

  if (!client_id) return { ok: false, error: "Missing client." };
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const db = supabaseAdmin();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const redirectTo = `${proto}://${host}/portal/auth/callback`;

  let userId: string | null = null;

  const { data: invited, error: inviteError } =
    await db.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError) {
    // Most likely they already have an account — from another client, or from
    // a previous invite. Reuse it rather than failing.
    const { data: list } = await db.auth.admin.listUsers();
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === email
    );
    if (!existing) return { ok: false, error: inviteError.message };
    userId = existing.id;
  } else {
    userId = invited.user?.id ?? null;
  }

  if (!userId) return { ok: false, error: "Could not create that login." };

  const { error } = await db.from("portal_users").upsert({
    id: userId,
    client_id,
    email,
    role: str(formData, "role") ?? "client_admin",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/clients/${client_id}`);
  return { ok: true };
}

/** Revokes portal access. Leaves the auth user intact, just unlinks them. */
export async function removePortalUser(userId: string, clientId: string) {
  const db = supabaseAdmin();
  await db.from("portal_users").delete().eq("id", userId);
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Resolves a client's replacement request. This is the ONLY thing that can
 * stop a lead counting against a pack.
 */
export async function resolveRequest(
  leadId: string,
  decision: "replaced" | "request_declined",
  note: string | null
) {
  const db = supabaseAdmin();

  const { data: before } = await db
    .from("leads")
    .select("status, client_id")
    .eq("id", leadId)
    .single();

  await db
    .from("leads")
    .update({
      status: decision,
      resolved_at: new Date().toISOString(),
      resolution_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  await db.from("lead_events").insert({
    lead_id: leadId,
    event_type: "resolved",
    old_value: before?.status ?? null,
    new_value: decision,
    actor: "admin",
    note,
  });

  revalidatePath("/admin/requests");
  revalidatePath("/admin/leads");
  if (before?.client_id) revalidatePath(`/admin/clients/${before.client_id}`);
  revalidatePath("/admin");
}
