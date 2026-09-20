import Link from "next/link";
import { currentPortalUser, supabaseServer } from "@/lib/supabase-server";
import type { Lead, PackUsage } from "@/lib/types";
import { EmptyState, formatDate, formatDateTime } from "@/components/ui";
import { LeadStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function PortalDashboard() {
  const session = await currentPortalUser();
  if (!session?.client) return null; // Layout has already handled this.

  const db = await supabaseServer();

  const [packRes, recentRes, monthRes, flaggedRes] = await Promise.all([
    db.from("pack_usage").select("*").eq("status", "active").maybeSingle(),
    db.from("leads").select("*").order("received_at", { ascending: false }).limit(5),
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("received_at", startOfMonth()),
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "replacement_requested"),
  ]);

  const pack = packRes.data as PackUsage | null;
  const recent = (recentRes.data ?? []) as Lead[];

  const used = pack?.leads_used ?? 0;
  const size = pack?.size ?? 0;
  const remaining = pack?.leads_remaining ?? 0;
  const pct = size > 0 ? Math.min((used / size) * 100, 100) : 0;

  return (
    <>
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl sm:text-4xl">
          {session.client.business_name}
        </h1>
        <p className="text-lg text-muted mt-1">Here&apos;s where your leads are at.</p>
      </div>

      {/* ---- the one number that matters ---- */}
      {pack ? (
        <div
          className="card p-8 sm:p-10 mb-8 animate-fade-up"
          style={{ animationDelay: "0.06s" }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
                Your current pack
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl sm:text-7xl font-bold text-navy tabular-nums leading-none">
                  {used}
                </span>
                <span className="text-2xl sm:text-3xl text-muted font-medium">
                  of {size} leads
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl sm:text-5xl font-bold text-blue tabular-nums leading-none">
                {remaining}
              </div>
              <div className="text-sm text-muted mt-1">still to come</div>
            </div>
          </div>

          <div className="h-4 rounded-full bg-panel overflow-hidden">
            <div
              className="h-full rounded-full bg-blue transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <span>Pack started {formatDate(pack.started_at)}</span>
            {pack.leads_replaced > 0 && (
              <span>
                <strong className="text-navy">{pack.leads_replaced}</strong> replaced
                (not counted)
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-8 mb-8 animate-fade-up">
          <h2 className="text-xl mb-1">No active pack</h2>
          <p className="text-body">
            You don&apos;t have a pack running right now. Any leads we send still
            appear below. Get in touch when you&apos;re ready for more.
          </p>
        </div>
      )}

      {/* ---- quick stats ---- */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10 stagger">
        <StatTile label="Leads this month" value={monthRes.count ?? 0} />
        <StatTile
          label="Awaiting review"
          value={flaggedRes.count ?? 0}
          hint={flaggedRes.count ? "We're looking at these" : "Nothing flagged"}
        />
        <StatTile
          label="Total this pack"
          value={used}
          hint={size ? `${remaining} remaining` : undefined}
        />
      </div>

      {/* ---- recent leads ---- */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl">Latest leads</h2>
        <Link href="/portal/leads" className="btn btn-ghost btn-sm">
          See all
        </Link>
      </div>

      {recent.length === 0 ? (
        <EmptyState title="No leads yet">
          As soon as we send you one, it&apos;ll show up right here.
        </EmptyState>
      ) : (
        <div className="grid gap-3 stagger">
          {recent.map((lead) => (
            <Link
              key={lead.id}
              href="/portal/leads"
              className="card card-hover p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-lg font-semibold text-navy">
                  {lead.name ?? "New lead"}
                </div>
                <div className="text-body">
                  {[lead.phone, lead.postcode].filter(Boolean).join(" · ") ||
                    "No contact details"}
                </div>
                <div className="text-sm text-muted mt-0.5">
                  {formatDateTime(lead.received_at)}
                </div>
              </div>
              <LeadStatusBadge status={lead.status} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function StatTile({
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
