import { supabaseAdmin } from "./supabase-admin";
import type { Client, Lead, PackUsage } from "./types";

/**
 * The "Revena Admin" tool surface.
 *
 * Every handler returns a human-readable string — Claude reads these back to
 * Rylan, so they're written as sentences rather than dumped JSON. All of them
 * run through the service-role key; authorisation happens once, at the route,
 * against MCP_API_KEY.
 */

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const TOOLS: ToolDef[] = [
  {
    name: "create_client",
    description:
      "Onboard a new Revena client. Creates the client record and, if a pack size is given, their opening pack. The GHL tag is what routes incoming leads to them, so it must be unique.",
    inputSchema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "Trading name of the business" },
        contact_name: { type: "string", description: "Main contact person" },
        email: { type: "string", description: "Contact email" },
        phone: { type: "string", description: "Contact phone" },
        service_type: {
          type: "string",
          enum: ["residential", "commercial", "both"],
          description: "What kind of work they take. Defaults to 'both'.",
        },
        region: { type: "string", description: "Coverage area, e.g. 'Brisbane + Gold Coast'" },
        ghl_tag_reference: {
          type: "string",
          description: "The GHL tag that routes leads to this client. Must be unique.",
        },
        pack_size: { type: "number", description: "Opening pack size in leads. Optional." },
        pack_price: { type: "number", description: "What they paid for the opening pack, AUD." },
        invite_email: {
          type: "string",
          description:
            "If given, also creates a portal login and emails them a magic-link invite.",
        },
      },
      required: ["business_name"],
    },
  },
  {
    name: "get_client",
    description:
      "Look up one client by business name (partial match is fine) or id. Returns their status, current pack usage, and recent leads.",
    inputSchema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "Name or part of it" },
        client_id: { type: "string", description: "Exact client UUID" },
      },
    },
  },
  {
    name: "list_clients",
    description: "Roster of all clients with their pack usage. Optionally filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "paused", "churned"],
          description: "Omit to list everyone.",
        },
      },
    },
  },
  {
    name: "update_client_pack",
    description:
      "Start a new pack for a client — this is how a renewal is recorded. Closes their current pack and begins counting against the new one.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "Client UUID" },
        business_name: { type: "string", description: "Or identify them by name" },
        new_pack_size: { type: "number", description: "Size of the new pack, in leads" },
        new_start_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        price: { type: "number", description: "What they paid, AUD" },
      },
      required: ["new_pack_size"],
    },
  },
  {
    name: "get_dispute_queue",
    description:
      "Replacement requests waiting on a decision — leads a client has flagged as bad. Nothing changes on their pack until these are resolved. Returns lead ids for use with resolve_replacement.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_client",
    description:
      "Change a client's details or status. Only the fields you pass are changed. Set status to 'paused' to stop new leads counting against a pack, or 'churned' when they leave.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "Client UUID" },
        business_name: { type: "string", description: "Or identify them by name" },
        new_business_name: { type: "string", description: "Rename the business" },
        contact_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        phone_number: { type: "string", description: "Alias for phone" },
        service_type: { type: "string", enum: ["residential", "commercial", "both"] },
        region: { type: "string" },
        ghl_tag_reference: {
          type: "string",
          description: "The GHL tag that routes leads here. Must stay unique.",
        },
        status: { type: "string", enum: ["active", "paused", "churned"] },
        notes: { type: "string", description: "Internal notes, never shown to the client" },
      },
    },
  },
  {
    name: "delete_client",
    description:
      "Permanently delete a client, their packs and their portal logins. Their leads are kept but become unassigned. This cannot be undone — you must pass confirm: true.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        business_name: { type: "string" },
        confirm: {
          type: "boolean",
          description: "Must be true. A guard against deleting the wrong business.",
        },
      },
      required: ["confirm"],
    },
  },
  {
    name: "invite_portal_user",
    description:
      "Give someone a login to a client's portal, or resend the link if they already have one. Emails them a magic link — no password involved.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        business_name: { type: "string", description: "Or identify the client by name" },
        email: { type: "string", description: "Who to invite" },
      },
      required: ["email"],
    },
  },
  {
    name: "remove_portal_user",
    description:
      "Revoke someone's access to the portal. Their login still exists but reaches nothing.",
    inputSchema: {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  },
  {
    name: "list_portal_users",
    description: "Who can log in, and which client they belong to.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        business_name: { type: "string", description: "Omit both to list everyone" },
      },
    },
  },
  {
    name: "resolve_replacement",
    description:
      "Decide a replacement request. Approving is the ONLY thing that stops a lead counting against a client's pack. Get lead ids from get_dispute_queue.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        decision: {
          type: "string",
          enum: ["approve", "decline"],
          description: "approve credits the lead back; decline leaves it counted",
        },
        note: { type: "string", description: "Why — shown to the client if declined" },
      },
      required: ["lead_id", "decision"],
    },
  },
  {
    name: "list_leads",
    description: "Recent leads, optionally filtered by client or delivery status.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        business_name: { type: "string", description: "Or identify the client by name" },
        status: {
          type: "string",
          enum: ["delivered", "replacement_requested", "replaced", "request_declined"],
        },
        unassigned: { type: "boolean", description: "Only leads with no client" },
        limit: { type: "number", description: "Default 25" },
      },
    },
  },
  {
    name: "assign_lead",
    description:
      "Place an unassigned lead with a client, or move a mis-routed one. Attaches it to that client's active pack so it starts counting.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        client_id: { type: "string" },
        business_name: { type: "string", description: "Or identify the client by name" },
      },
      required: ["lead_id"],
    },
  },
];

type Args = Record<string, unknown>;

function str(args: Args, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(args: Args, key: string): number | null {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** Resolves a client from either an id or a name, so callers can use either. */
async function findClient(args: Args): Promise<
  { client: Client } | { error: string }
> {
  const db = supabaseAdmin();
  const id = str(args, "client_id");

  if (id) {
    const { data } = await db.from("clients").select("*").eq("id", id).maybeSingle();
    if (!data) return { error: `No client with id ${id}.` };
    return { client: data as Client };
  }

  const name = str(args, "business_name");
  if (!name) return { error: "Give either client_id or business_name." };

  const { data } = await db.from("clients").select("*").ilike("business_name", `%${name}%`);
  const matches = (data ?? []) as Client[];

  if (matches.length === 0) return { error: `No client matching "${name}".` };
  if (matches.length > 1) {
    // Guessing here could start a pack for the wrong business.
    return {
      error: `"${name}" matches ${matches.length} clients: ${matches
        .map((c) => c.business_name)
        .join(", ")}. Be more specific or pass client_id.`,
    };
  }
  return { client: matches[0] };
}

function describePack(usage: PackUsage | null | undefined): string {
  if (!usage) return "No active pack.";
  return `${usage.leads_used} of ${usage.size} used, ${usage.leads_remaining} remaining${
    usage.leads_replaced ? `, ${usage.leads_replaced} replaced` : ""
  }${usage.flags_pending ? `, ${usage.flags_pending} flagged and awaiting your call` : ""}.`;
}

/**
 * @param origin  The public origin of this deployment, used to build the portal
 *                invite link. Passed in from the route rather than read from an env
 *                var so it is always the host the request actually arrived on.
 */
export async function callTool(
  name: string,
  args: Args,
  origin: string
): Promise<string> {
  const db = supabaseAdmin();

  switch (name) {
    // ---------------------------------------------------------------
    case "create_client": {
      const business_name = str(args, "business_name");
      if (!business_name) return "business_name is required.";

      const { data: client, error } = await db
        .from("clients")
        .insert({
          business_name,
          contact_name: str(args, "contact_name"),
          email: str(args, "email"),
          phone: str(args, "phone"),
          service_type: str(args, "service_type") ?? "both",
          region: str(args, "region"),
          ghl_tag_reference: str(args, "ghl_tag_reference"),
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          return `That GHL tag is already used by another client. Tags must be unique or leads can't be routed.`;
        }
        return `Could not create the client: ${error.message}`;
      }

      const lines = [`Created ${business_name}.`];

      const packSize = num(args, "pack_size");
      if (packSize && packSize > 0) {
        const { error: packError } = await db.from("packs").insert({
          client_id: client.id,
          size: packSize,
          price: num(args, "pack_price") ?? 0,
        });
        lines.push(
          packError
            ? `Pack failed: ${packError.message}`
            : `Opened a ${packSize}-lead pack.`
        );
      } else {
        lines.push("No pack yet — leads will arrive but won't count against one.");
      }

      const inviteEmail = str(args, "invite_email");
      if (inviteEmail) {
        const { data: invited, error: inviteError } =
          await db.auth.admin.inviteUserByEmail(inviteEmail, {
            redirectTo: `${origin}/portal/auth/callback`,
          });
        if (inviteError || !invited.user) {
          lines.push(`Portal invite failed: ${inviteError?.message ?? "unknown error"}`);
        } else {
          const { error: linkError } = await db.from("portal_users").upsert({
            id: invited.user.id,
            client_id: client.id,
            email: inviteEmail,
            role: "client_admin",
          });
          lines.push(
            linkError
              ? `Invite sent but linking failed: ${linkError.message}`
              : `Portal invite sent to ${inviteEmail}.`
          );
        }
      }

      if (!str(args, "ghl_tag_reference")) {
        lines.push(
          "No GHL tag set — nothing can route to them until you add one."
        );
      }

      lines.push(`Client id: ${client.id}`);
      return lines.join(" ");
    }

    // ---------------------------------------------------------------
    case "get_client": {
      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      const [usageRes, leadsRes] = await Promise.all([
        db.from("pack_usage").select("*").eq("client_id", client.id).eq("status", "active").maybeSingle(),
        db
          .from("leads")
          .select("*")
          .eq("client_id", client.id)
          .order("received_at", { ascending: false })
          .limit(10),
      ]);

      const leads = (leadsRes.data ?? []) as Lead[];

      const lines = [
        `${client.business_name} — ${client.status}`,
        client.contact_name || client.email
          ? `Contact: ${[client.contact_name, client.email, client.phone].filter(Boolean).join(", ")}`
          : null,
        `Service: ${client.service_type}${client.region ? ` in ${client.region}` : ""}`,
        `GHL tag: ${client.ghl_tag_reference ?? "NOT SET — leads can't route here"}`,
        `Pack: ${describePack(usageRes.data as PackUsage | null)}`,
        "",
        leads.length
          ? `Last ${leads.length} leads:`
          : "No leads delivered yet.",
        ...leads.map(
          (l) =>
            `  ${new Date(l.received_at).toLocaleDateString("en-AU")} — ${l.name ?? "no name"} (${l.postcode ?? "?"}) — ${l.status}`
        ),
      ].filter((l) => l !== null);

      return lines.join("\n");
    }

    // ---------------------------------------------------------------
    case "list_clients": {
      let query = db.from("clients").select("*").order("business_name");
      const status = str(args, "status");
      if (status) query = query.eq("status", status);

      const [clientsRes, usageRes] = await Promise.all([
        query,
        db.from("pack_usage").select("*").eq("status", "active"),
      ]);

      const clients = (clientsRes.data ?? []) as Client[];
      if (clients.length === 0) return "No clients match.";

      const usage = new Map(
        ((usageRes.data ?? []) as PackUsage[]).map((u) => [u.client_id, u])
      );

      return clients
        .map(
          (c) =>
            `${c.business_name} [${c.status}] — ${describePack(usage.get(c.id))}${
              c.ghl_tag_reference ? "" : " NO GHL TAG."
            }`
        )
        .join("\n");
    }

    // ---------------------------------------------------------------
    case "update_client_pack": {
      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      const size = num(args, "new_pack_size");
      if (!size || size < 1) return "new_pack_size must be at least 1.";

      // Closing the current pack first — the partial unique index allows only
      // one active pack per client, and its raw error wouldn't explain itself.
      const { data: closed } = await db
        .from("packs")
        .update({ status: "completed", ended_at: new Date().toISOString().slice(0, 10) })
        .eq("client_id", client.id)
        .eq("status", "active")
        .select("id, size");

      const { error } = await db.from("packs").insert({
        client_id: client.id,
        size,
        price: num(args, "price") ?? 0,
        started_at: str(args, "new_start_date") ?? new Date().toISOString().slice(0, 10),
      });

      if (error) return `Could not start the pack: ${error.message}`;

      return [
        closed?.length
          ? `Closed ${client.business_name}'s previous pack.`
          : `${client.business_name} had no open pack.`,
        `Started a new ${size}-lead pack. Leads from now count against it.`,
      ].join(" ");
    }

    // ---------------------------------------------------------------
    case "get_dispute_queue": {
      const { data, error } = await db
        .from("leads")
        .select("*")
        .eq("status", "replacement_requested")
        .order("flagged_at", { ascending: true });

      if (error) return `Could not read the queue: ${error.message}`;

      const leads = (data ?? []) as Lead[];
      if (leads.length === 0) return "Nothing waiting — no open replacement requests.";

      const { data: clientRows } = await db.from("clients").select("id, business_name");
      const names = new Map(
        ((clientRows ?? []) as Pick<Client, "id" | "business_name">[]).map((c) => [
          c.id,
          c.business_name,
        ])
      );

      return [
        `${leads.length} replacement request${leads.length === 1 ? "" : "s"} waiting:`,
        ...leads.map((l) =>
          [
            `  ${l.client_id ? names.get(l.client_id) ?? "Unknown" : "Unassigned"}`,
            `${l.name ?? "no name"} (${l.postcode ?? "?"})`,
            `reason: ${l.flag_reason ?? "none given"}`,
            l.flag_note ? `note: "${l.flag_note}"` : null,
            `id ${l.id}`,
          ]
            .filter(Boolean)
            .join(" — ")
        ),
        "",
        "Resolve with resolve_replacement(lead_id, approve|decline) — approving is the only thing that credits a lead back.",
      ].join("\n");
    }

    // ---------------------------------------------------------------
    case "update_client": {
      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      // Only what was actually passed — an omitted field must not be blanked.
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const rename = str(args, "new_business_name");
      if (rename) patch.business_name = rename;
      for (const f of ["contact_name", "email", "region", "notes", "service_type", "status", "ghl_tag_reference"]) {
        const v = str(args, f);
        if (v) patch[f] = v;
      }
      const phone = str(args, "phone") ?? str(args, "phone_number");
      if (phone) patch.phone = phone;

      if (Object.keys(patch).length === 1) {
        return "Nothing to change — pass at least one field.";
      }

      const { error } = await db.from("clients").update(patch).eq("id", client.id);
      if (error) {
        if (error.code === "23505") {
          return "Another client already uses that GHL tag. Tags must be unique or leads can't be routed.";
        }
        return `Could not update: ${error.message}`;
      }

      const changed = Object.keys(patch).filter((k) => k !== "updated_at");
      return `Updated ${rename ?? client.business_name}: ${changed.join(", ")}.`;
    }

    // ---------------------------------------------------------------
    case "delete_client": {
      if (args.confirm !== true) {
        return "Not deleted. Pass confirm: true to go ahead — this can't be undone.";
      }
      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      // Count first, so the confirmation can say what actually went.
      const [{ count: leadCount }, { count: packCount }] = await Promise.all([
        db.from("leads").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        db.from("packs").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      ]);

      const { error } = await db.from("clients").delete().eq("id", client.id);
      if (error) return `Could not delete: ${error.message}`;

      return [
        `Deleted ${client.business_name} along with ${packCount ?? 0} pack(s) and their portal logins.`,
        `${leadCount ?? 0} lead(s) were kept and are now unassigned — place them with assign_lead if they belong elsewhere.`,
      ].join(" ");
    }

    // ---------------------------------------------------------------
    case "invite_portal_user": {
      const email = str(args, "email")?.toLowerCase();
      if (!email) return "email is required.";

      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      const redirectTo = `${origin}/portal/auth/callback`;

      // Already has a login? Then this is a resend, and inviteUserByEmail
      // would fail — signInWithOtp is the call that works for existing users.
      const { data: list } = await db.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email?.toLowerCase() === email);

      if (existing) {
        await db.from("portal_users").upsert({
          id: existing.id,
          client_id: client.id,
          email,
          role: "client_admin",
        });

        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_ANON_KEY;
        if (!url || !anon) return "Supabase anon key isn't configured, so the link can't be sent.";

        const { createClient: createSupabase } = await import("@supabase/supabase-js");
        const auth = createSupabase(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await auth.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) return `Linked to ${client.business_name}, but the email failed: ${error.message}`;
        return `${email} already had a login — linked to ${client.business_name} and sent a fresh link.`;
      }

      const { data: invited, error: inviteError } =
        await db.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (inviteError || !invited.user) {
        return `Invite failed: ${inviteError?.message ?? "unknown error"}`;
      }

      const { error } = await db.from("portal_users").upsert({
        id: invited.user.id,
        client_id: client.id,
        email,
        role: "client_admin",
      });
      if (error) return `Invite sent but linking failed: ${error.message}`;

      return `Invited ${email} to ${client.business_name}'s portal.`;
    }

    // ---------------------------------------------------------------
    case "remove_portal_user": {
      const email = str(args, "email")?.toLowerCase();
      if (!email) return "email is required.";

      const { data: rows } = await db
        .from("portal_users")
        .delete()
        .eq("email", email)
        .select("email");

      if (!rows?.length) return `No portal access found for ${email}.`;
      return `${email} can no longer reach the portal.`;
    }

    // ---------------------------------------------------------------
    case "list_portal_users": {
      let q = db.from("portal_users").select("email, role, client_id");
      if (str(args, "client_id") || str(args, "business_name")) {
        const found = await findClient(args);
        if ("error" in found) return found.error;
        q = q.eq("client_id", found.client.id);
      }
      const { data } = await q;
      const rows = (data ?? []) as { email: string; role: string; client_id: string }[];
      if (!rows.length) return "Nobody has portal access yet.";

      const { data: clientRows } = await db.from("clients").select("id, business_name");
      const names = new Map(
        ((clientRows ?? []) as Pick<Client, "id" | "business_name">[]).map((c) => [c.id, c.business_name])
      );
      return rows
        .map((r) => `${r.email} — ${names.get(r.client_id) ?? "unknown client"} (${r.role})`)
        .join("\n");
    }

    // ---------------------------------------------------------------
    case "resolve_replacement": {
      const leadId = str(args, "lead_id");
      const decision = str(args, "decision");
      if (!leadId) return "lead_id is required — get them from get_dispute_queue.";
      if (decision !== "approve" && decision !== "decline") {
        return "decision must be 'approve' or 'decline'.";
      }

      const { data: lead } = await db
        .from("leads")
        .select("id, status, client_id, name")
        .eq("id", leadId)
        .maybeSingle();

      if (!lead) return `No lead with id ${leadId}.`;
      if (lead.status !== "replacement_requested") {
        return `That lead isn't awaiting a decision — it's currently '${lead.status}'.`;
      }

      const newStatus = decision === "approve" ? "replaced" : "request_declined";
      const note = str(args, "note");

      const { error } = await db
        .from("leads")
        .update({
          status: newStatus,
          resolved_at: new Date().toISOString(),
          resolution_note: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (error) return `Could not resolve: ${error.message}`;

      await db.from("lead_events").insert({
        lead_id: leadId,
        event_type: "resolved",
        old_value: "replacement_requested",
        new_value: newStatus,
        actor: "admin (via MCP)",
        note,
      });

      return decision === "approve"
        ? `Approved. ${lead.name ?? "That lead"} no longer counts against their pack.`
        : `Declined. ${lead.name ?? "That lead"} still counts against their pack.`;
    }

    // ---------------------------------------------------------------
    case "list_leads": {
      let q = db
        .from("leads")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(num(args, "limit") ?? 25);

      if (args.unassigned === true) {
        q = q.is("client_id", null);
      } else if (str(args, "client_id") || str(args, "business_name")) {
        const found = await findClient(args);
        if ("error" in found) return found.error;
        q = q.eq("client_id", found.client.id);
      }
      const status = str(args, "status");
      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) return `Could not read leads: ${error.message}`;
      const leads = (data ?? []) as Lead[];
      if (!leads.length) return "No leads match.";

      const { data: clientRows } = await db.from("clients").select("id, business_name");
      const names = new Map(
        ((clientRows ?? []) as Pick<Client, "id" | "business_name">[]).map((c) => [c.id, c.business_name])
      );

      return leads
        .map(
          (l) =>
            `${new Date(l.received_at).toLocaleDateString("en-AU")} — ${l.name ?? "no name"} (${l.postcode ?? "?"}) — ${
              l.client_id ? names.get(l.client_id) ?? "unknown" : "UNASSIGNED"
            } — ${l.status}${l.flag_reason ? ` [${l.flag_reason}]` : ""} — id ${l.id}`
        )
        .join("\n");
    }

    // ---------------------------------------------------------------
    case "assign_lead": {
      const leadId = str(args, "lead_id");
      if (!leadId) return "lead_id is required — get them from list_leads.";

      const found = await findClient(args);
      if ("error" in found) return found.error;
      const client = found.client;

      const { data: before } = await db
        .from("leads")
        .select("client_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!before) return `No lead with id ${leadId}.`;

      const { data: pack } = await db
        .from("packs")
        .select("id")
        .eq("client_id", client.id)
        .eq("status", "active")
        .maybeSingle();

      const { error } = await db
        .from("leads")
        .update({
          client_id: client.id,
          pack_id: pack?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (error) return `Could not assign: ${error.message}`;

      await db.from("lead_events").insert({
        lead_id: leadId,
        event_type: before.client_id ? "reassigned" : "assigned",
        old_value: before.client_id ?? "unassigned",
        new_value: client.id,
        actor: "admin (via MCP)",
      });

      return pack
        ? `Assigned to ${client.business_name} and counted against their active pack.`
        : `Assigned to ${client.business_name}, but they have no active pack so it isn't counting against one.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
