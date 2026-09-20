import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, Lead } from "@/lib/types";
import { ResolveRequest } from "@/components/lead-actions";
import {
  PageHeader,
  EmptyState,
  Badge,
  LeadStatusBadge,
  formatDateTime,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const db = supabaseAdmin();

  const [pendingRes, recentRes, clientsRes] = await Promise.all([
    db
      .from("leads")
      .select("*")
      .eq("status", "replacement_requested")
      .order("flagged_at", { ascending: true, nullsFirst: false }),
    // Recently resolved, so you can see what you decided and reverse course
    // in conversation if a client pushes back.
    db
      .from("leads")
      .select("*")
      .in("status", ["replaced", "request_declined"])
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(20),
    db.from("clients").select("id, business_name"),
  ]);

  const pending = (pendingRes.data ?? []) as Lead[];
  const recent = (recentRes.data ?? []) as Lead[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "business_name">[];
  const clientNames = new Map(clients.map((c) => [c.id, c.business_name]));

  return (
    <>
      <PageHeader
        title="Replacement requests"
        subtitle="Clients flag leads they think were bad. You decide — nothing changes until you do."
      />

      {pending.length === 0 ? (
        <EmptyState title="Nothing waiting on you">
          No client has flagged a lead for replacement.
        </EmptyState>
      ) : (
        <div className="grid gap-4 stagger">
          {pending.map((lead) => (
            <div key={lead.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">
                      {lead.name ?? "No name"}
                    </span>
                    {lead.client_id && (
                      <Link
                        href={`/admin/clients/${lead.client_id}`}
                        className="text-sm text-blue hover:underline"
                      >
                        {clientNames.get(lead.client_id) ?? "Unknown client"}
                      </Link>
                    )}
                  </div>
                  <div className="text-sm text-body mt-0.5">
                    {[lead.phone, lead.email, lead.postcode]
                      .filter(Boolean)
                      .join(" · ") || "No contact details"}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Delivered {formatDateTime(lead.received_at)} · Flagged{" "}
                    {formatDateTime(lead.flagged_at)}
                  </div>
                </div>
                {lead.flag_reason && <Badge tone="warn">{lead.flag_reason}</Badge>}
              </div>

              {lead.flag_note && (
                <blockquote className="mt-3 rounded-xl bg-panel px-4 py-3 text-sm text-body">
                  {lead.flag_note}
                </blockquote>
              )}

              <ResolveRequest leadId={lead.id} />
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-navy mt-10 mb-4">
            Recently resolved
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-panel text-left">
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Resolved</th>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Reason given</th>
                  <th className="px-4 py-3 font-semibold">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((lead) => (
                  <tr key={lead.id} className="border-t border-line">
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {formatDateTime(lead.resolved_at)}
                    </td>
                    <td className="px-4 py-3 text-navy font-medium">
                      {lead.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {lead.client_id ? clientNames.get(lead.client_id) ?? "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.flag_reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
