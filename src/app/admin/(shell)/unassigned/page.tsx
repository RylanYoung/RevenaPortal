import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, Lead } from "@/lib/types";
import { AssignLead } from "@/components/lead-actions";
import { PageHeader, EmptyState, Badge, formatDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UnassignedPage() {
  const db = supabaseAdmin();

  const [leadsRes, clientsRes] = await Promise.all([
    db
      .from("leads")
      .select("*")
      .is("client_id", null)
      .order("received_at", { ascending: false }),
    db
      .from("clients")
      .select("id, business_name")
      .eq("status", "active")
      .order("business_name"),
  ]);

  const leads = (leadsRes.data ?? []) as Lead[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "business_name">[];

  return (
    <>
      <PageHeader
        title="Unassigned leads"
        subtitle="Leads that arrived without a tag matching any client. Nothing is ever dropped — it waits here."
      />

      {leads.length === 0 ? (
        <EmptyState title="Nothing waiting">
          Every lead that&apos;s come in has routed to a client.
        </EmptyState>
      ) : (
        <div className="grid gap-4 stagger">
          {leads.map((lead) => (
            <div key={lead.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-navy">{lead.name ?? "No name"}</div>
                  <div className="text-sm text-body mt-0.5">
                    {[lead.phone, lead.email].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {formatDateTime(lead.received_at)}
                    {lead.postcode ? ` · ${lead.postcode}` : ""}
                    {lead.source ? ` · ${lead.source}` : ""}
                  </div>
                </div>

                <AssignLead leadId={lead.id} clients={clients} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Tags
                </span>
                {lead.ghl_tags.length > 0 ? (
                  lead.ghl_tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  // No tags at all usually means the automation didn't apply one
                  // before firing, which is worth knowing when you go fix it.
                  <Badge tone="danger">None sent</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {leads.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Seeing the same tag here repeatedly? Add it as a client&apos;s GHL tag and
          future leads will route automatically.
        </p>
      )}
    </>
  );
}
