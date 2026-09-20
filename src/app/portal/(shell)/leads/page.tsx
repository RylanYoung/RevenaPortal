import { supabaseServer } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, OUTCOMES, OUTCOME_LABELS } from "@/lib/types";
import { PortalLeadCard } from "@/components/portal-lead-card";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalLeadsPage({
  searchParams,
}: PageProps<"/portal/leads">) {
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const outcomeFilter = typeof sp.outcome === "string" ? sp.outcome : "";

  const db = await supabaseServer();

  // No client_id filter needed anywhere here — RLS scopes every row to the
  // logged-in client automatically.
  let query = db.from("leads").select("*").order("received_at", { ascending: false });

  if (statusFilter && (LEAD_STATUSES as readonly string[]).includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  if (outcomeFilter === "none") {
    query = query.is("outcome", null);
  } else if (outcomeFilter && (OUTCOMES as readonly string[]).includes(outcomeFilter)) {
    query = query.eq("outcome", outcomeFilter);
  }

  const { data, error } = await query;
  const leads = (data ?? []) as Lead[];

  return (
    <>
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl sm:text-4xl">My leads</h1>
        <p className="text-lg text-muted mt-1">
          Everything we&apos;ve sent you, newest first.
        </p>
      </div>

      <form className="card p-5 mb-6 flex flex-wrap items-end gap-4 animate-fade-up">
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={statusFilter} className="field w-auto">
            <option value="">All leads</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="outcome">
            Your progress
          </label>
          <select id="outcome" name="outcome" defaultValue={outcomeFilter} className="field w-auto">
            <option value="">Any</option>
            <option value="none">Not tracked yet</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-ghost btn-sm">
          Apply
        </button>
        {(statusFilter || outcomeFilter) && (
          <a href="/portal/leads" className="text-sm text-muted hover:text-navy">
            Clear
          </a>
        )}
      </form>

      {error && <p className="mb-4 text-sm text-danger">{error.message}</p>}

      {leads.length === 0 ? (
        <EmptyState title="Nothing here yet">
          {statusFilter || outcomeFilter
            ? "No leads match those filters."
            : "As soon as we send you a lead, it'll appear here."}
        </EmptyState>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </p>
          <div className="grid gap-4 stagger">
            {leads.map((lead) => (
              <PortalLeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
