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
      "Replacement requests waiting on a decision — leads a client has flagged as bad. Nothing changes on their pack until these are resolved.",
    inputSchema: { type: "object", properties: {} },
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

export async function callTool(name: string, args: Args): Promise<string> {
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
          await db.auth.admin.inviteUserByEmail(inviteEmail);
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
          ]
            .filter(Boolean)
            .join(" — ")
        ),
        "",
        "Resolve these at /admin/requests — approving a replacement is the only thing that credits a lead back.",
      ].join("\n");
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
