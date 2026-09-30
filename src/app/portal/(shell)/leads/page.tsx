import { supabaseServer } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, PIPELINE_STAGES } from "@/lib/types";
import { PortalLeadCard } from "@/components/portal-lead-card";
import { EmptyState } from "@/components/ui";
import { PipelineBar } from "@/components/pipeline-bar";

export const dynamic = "force-dynamic";

export default async function PortalLeadsPage({
  searchParams,
}: PageProps<"/portal/leads">) {
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const stageFilter = typeof sp.stage === "string" ? sp.stage : "";

  const db = await supabaseServer();

  // No client_id filter needed anywhere here — RLS scopes every row to the
  // logged-in client automatically.
  // Everything is fetched, then filtered here: the pipeline counts have to
  // reflect ALL their leads, not just the ones matching the current filter.
  const { data, error } = await db
    .from("leads")
    .select("*")
    .order("received_at", { ascending: false });

  const allLeads = (data ?? []) as Lead[];

  let leads = allLeads;
  if (statusFilter && (LEAD_STATUSES as readonly string[]).includes(statusFilter)) {
    leads = leads.filter((l) => l.status === statusFilter);
  }
  if (stageFilter && (PIPELINE_STAGES as readonly string[]).includes(stageFilter)) {
    // An untouched lead IS a new lead, so the New column has to include the
    // ones with no stage set rather than only explicit ones.
    leads =
      stageFilter === "new"
        ? leads.filter((l) => !l.outcome || l.outcome === "new")
        : leads.filter((l) => l.outcome === stageFilter);
  }

  return (
    <>
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl sm:text-4xl">My leads</h1>
        <p className="text-lg text-muted mt-1">
          Everything we&apos;ve sent you, newest first.
        </p>
      </div>

      {/* The pipeline replaces the old progress dropdown: the counts are the
          useful part, and tapping one is fewer actions than select-then-apply. */}
      <PipelineBar leads={allLeads} active={stageFilter} />

      <form className="card p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="status">
            Delivery status
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

        {/* Keeps the chosen stage when the status filter is applied. */}
        {stageFilter && <input type="hidden" name="stage" value={stageFilter} />}

        <button type="submit" className="btn btn-ghost btn-sm">
          Apply
        </button>
        {(statusFilter || stageFilter) && (
          <a href="/portal/leads" className="text-sm text-muted hover:text-navy">
            Clear
          </a>
        )}
      </form>

      {error && <p className="mb-4 text-sm text-danger">{error.message}</p>}

      {leads.length === 0 ? (
        <EmptyState title="Nothing here yet">
          {statusFilter || stageFilter
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
