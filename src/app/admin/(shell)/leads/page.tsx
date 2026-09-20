import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, Lead, LeadStatus } from "@/lib/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/types";
import { LeadsTable } from "@/components/leads-table";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  // Next.js 16: searchParams arrive as a promise.
  const sp = await searchParams;
  const clientFilter = typeof sp.client === "string" ? sp.client : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";

  const db = supabaseAdmin();

  let query = db
    .from("leads")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (clientFilter === "unassigned") {
    query = query.is("client_id", null);
  } else if (clientFilter) {
    query = query.eq("client_id", clientFilter);
  }
  // Guard against a hand-edited URL reaching Postgres as an invalid enum value.
  if (statusFilter && (LEAD_STATUSES as readonly string[]).includes(statusFilter)) {
    query = query.eq("status", statusFilter as LeadStatus);
  }

  const [leadsRes, clientsRes] = await Promise.all([
    query,
    db.from("clients").select("id, business_name").order("business_name"),
  ]);

  const leads = (leadsRes.data ?? []) as Lead[];
  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "business_name">[];
  const clientNames = new Map(clients.map((c) => [c.id, c.business_name]));

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Everything delivered, newest first."
        action={
          <a
            // Carries the current filters, so you export what you're looking at.
            href={`/api/admin/export?${new URLSearchParams({
              ...(clientFilter ? { client: clientFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
            })}`}
            className="btn btn-ghost btn-sm"
          >
            Download CSV
          </a>
        }
      />

      {/* A plain GET form — filters live in the URL, so a filtered view is
          shareable and survives a refresh. */}
      <form className="card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="client">
            Client
          </label>
          <select id="client" name="client" defaultValue={clientFilter} className="field w-auto">
            <option value="">All clients</option>
            <option value="unassigned">Unassigned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter} className="field w-auto">
            <option value="">Any status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-ghost btn-sm">
          Apply
        </button>
        {(clientFilter || statusFilter) && (
          <a href="/admin/leads" className="text-sm text-muted hover:text-navy">
            Clear
          </a>
        )}
      </form>

      {leadsRes.error && (
        <p className="mb-4 text-sm text-danger">{leadsRes.error.message}</p>
      )}

      {leads.length >= PAGE_SIZE && (
        <p className="mb-3 text-xs text-muted">
          Showing the latest {PAGE_SIZE}. Narrow the filters to see further back.
        </p>
      )}

      <LeadsTable
        leads={leads}
        clientNames={clientNames}
        showClient
        emptyTitle="No leads match"
        emptyBody="Try clearing the filters, or wait for GHL to fire one in."
      />
    </>
  );
}
