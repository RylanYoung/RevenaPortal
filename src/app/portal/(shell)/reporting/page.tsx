import { supabaseServer } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";
import { bucketByMonth, summarise } from "@/lib/reporting";
import { MonthlyChart } from "@/components/monthly-chart";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportingPage() {
  const db = await supabaseServer();

  // RLS scopes this to the logged-in client automatically.
  const { data, error } = await db
    .from("leads")
    .select("*")
    .order("received_at", { ascending: false });

  const leads = (data ?? []) as Lead[];
  const months = bucketByMonth(leads, 12);
  const totals = summarise(leads);

  return (
    <>
      <div className="mb-8 animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Reporting</h1>
          <p className="text-lg text-muted mt-1">
            Your lead history, month by month.
          </p>
        </div>
        <a href="/api/portal/export" className="btn btn-ghost">
          Download CSV
        </a>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error.message}</p>}

      {leads.length === 0 ? (
        <EmptyState title="Nothing to report yet">
          Once we&apos;ve sent you some leads, your history shows up here.
        </EmptyState>
      ) : (
        <>
          {/* ---- close rate leads, when they've actually tracked outcomes ---- */}
          {totals.closeRate !== null ? (
            <div
              className="card p-8 mb-6 animate-fade-up"
              style={{ animationDelay: "0.05s" }}
            >
              <div className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
                Your close rate
              </div>
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="text-6xl font-bold text-navy tabular-nums leading-none">
                  {Math.round(totals.closeRate * 100)}%
                </span>
                <span className="text-lg text-muted">
                  {totals.won} won from {totals.tracked} leads you&apos;ve tracked
                </span>
              </div>
            </div>
          ) : (
            <div
              className="card p-6 mb-6 animate-fade-up"
              style={{ animationDelay: "0.05s" }}
            >
              <h2 className="text-lg mb-1">Want to see your close rate?</h2>
              <p className="text-body">
                Open any lead and hit <strong>Track this lead</strong> to mark
                whether you won it. Once you do, your close rate shows up here.
                Entirely optional.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3 mb-8 stagger">
            <Tile label="Total leads" value={totals.total} />
            <Tile
              label="Counted"
              value={totals.counted}
              hint="Against your packs"
            />
            <Tile
              label="Not counted"
              value={totals.notCounted}
              hint={
                totals.notCountedRate !== null && totals.notCounted > 0
                  ? `${Math.round(totals.notCountedRate * 100)}% of leads`
                  : "None"
              }
            />
          </div>

          <div className="card p-6 sm:p-8 animate-fade-up">
            <h2 className="text-xl mb-1">Leads per month</h2>
            <p className="text-sm text-muted mb-6">Last 12 months.</p>
            <MonthlyChart data={months} />
          </div>
        </>
      )}
    </>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card p-6">
      <div className="text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-2 text-4xl font-bold text-navy tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  );
}
