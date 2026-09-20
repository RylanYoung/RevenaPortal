import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, PackUsage } from "@/lib/types";
import { NewClientForm } from "@/components/new-client-form";
import {
  PageHeader,
  ClientStatusBadge,
  PackBar,
  EmptyState,
  Badge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const db = supabaseAdmin();

  const [clientsRes, usageRes] = await Promise.all([
    db.from("clients").select("*").order("business_name"),
    db.from("pack_usage").select("*").eq("status", "active"),
  ]);

  const clients = (clientsRes.data ?? []) as Client[];
  const usageByClient = new Map(
    ((usageRes.data ?? []) as PackUsage[]).map((u) => [u.client_id, u])
  );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Everyone buying leads, and where their current pack is up to."
        action={<NewClientForm />}
      />

      {clientsRes.error && (
        <p className="mb-4 text-sm text-danger">{clientsRes.error.message}</p>
      )}

      {clients.length === 0 ? (
        <EmptyState title="No clients yet">
          Add one above, then give its GHL tag to the automation that fires qualified leads.
        </EmptyState>
      ) : (
        <div className="grid gap-4 stagger">
          {clients.map((client) => {
            const pack = usageByClient.get(client.id);
            return (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="card card-hover p-5 flex flex-wrap items-center gap-5"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">{client.business_name}</span>
                    <ClientStatusBadge status={client.status} />
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {client.contact_name ?? "No contact"}
                    {client.region ? ` · ${client.region}` : ""}
                  </div>
                </div>

                <div className="min-w-[140px]">
                  {client.ghl_tag_reference ? (
                    <Badge tone="brand">{client.ghl_tag_reference}</Badge>
                  ) : (
                    // Without a tag, nothing can ever route to this client —
                    // worth calling out loudly rather than showing a blank.
                    <Badge tone="danger">No GHL tag</Badge>
                  )}
                </div>

                <div className="min-w-[200px] flex-1">
                  {pack ? (
                    <PackBar used={pack.leads_used} size={pack.size} />
                  ) : (
                    <span className="text-sm text-muted">No active pack</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
