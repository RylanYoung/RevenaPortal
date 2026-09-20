import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, PackUsage } from "@/lib/types";
import {
  StatCard,
  PackBar,
  ClientStatusBadge,
  PageHeader,
  EmptyState,
  formatDate,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function AdminOverview() {
  const db = supabaseAdmin();

  const [clientsRes, usageRes, monthRes, unassignedRes, requestsRes] =
    await Promise.all([
      db.from("clients").select("*").order("business_name"),
      db.from("pack_usage").select("*").eq("status", "active"),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("received_at", startOfMonth()),
      db.from("leads").select("id", { count: "exact", head: true }).is("client_id", null),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "replacement_requested"),
    ]);

  if (clientsRes.error) {
    return (
      <EmptyState title="Can't reach Supabase">
        {clientsRes.error.message}
        <p className="mt-3">
          Check <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
          <code>.env.local</code>, and make sure you&apos;ve run{" "}
          <code>supabase/schema.sql</code>.
        </p>
      </EmptyState>
    );
  }

  const clients = (clientsRes.data ?? []) as Client[];
  const usage = (usageRes.data ?? []) as PackUsage[];
  const usageByClient = new Map(usage.map((u) => [u.client_id, u]));

  const activeClients = clients.filter((c) => c.status === "active");

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Delivery and quality across every client."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8 stagger">
        <StatCard
          label="Active clients"
          value={activeClients.length}
          hint={
            clients.length !== activeClients.length
              ? `${clients.length - activeClients.length} paused or churned`
              : undefined
          }
        />
        <StatCard label="Leads this month" value={monthRes.count ?? 0} />
        <StatCard
          label="Unassigned"
          value={unassignedRes.count ?? 0}
          hint={unassignedRes.count ? "Needs placing" : "All routed"}
          tone={unassignedRes.count ? "warn" : "neutral"}
        />
        <StatCard
          label="Replacement requests"
          value={requestsRes.count ?? 0}
          hint={requestsRes.count ? "Waiting on you" : "Nothing pending"}
          tone={requestsRes.count ? "warn" : "neutral"}
        />
      </div>

      <h2 className="text-lg font-semibold text-navy mb-4">Pack status</h2>

      {clients.length === 0 ? (
        <EmptyState title="No clients yet">
          <Link href="/admin/clients" className="text-blue font-semibold">
            Add your first client
          </Link>{" "}
          to start routing leads.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {clients.map((client) => {
            const pack = usageByClient.get(client.id);
            return (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="card card-hover p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy truncate">
                      {client.business_name}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {client.region ?? "No region set"}
                    </div>
                  </div>
                  <ClientStatusBadge status={client.status} />
                </div>

                {pack ? (
                  <>
                    <PackBar used={pack.leads_used} size={pack.size} />
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                      <span>Started {formatDate(pack.started_at)}</span>
                      {pack.flags_pending > 0 && (
                        <span className="text-warn font-semibold">
                          {pack.flags_pending} flagged
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    No active pack — leads won&apos;t count against one.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
