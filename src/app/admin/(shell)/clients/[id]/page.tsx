import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client, Lead, Pack, PackUsage } from "@/lib/types";
import { LeadsTable } from "@/components/leads-table";
import { ClientStatusControl, NewPackForm, PackUsageEditor } from "@/components/client-controls";
import { AutoCountToggle } from "@/components/count-toggle";
import { PortalAccess } from "@/components/portal-access";
import { ONBOARDING, displayAnswer, type Answers } from "@/lib/onboarding";
import {
  PageHeader,
  PackBar,
  Badge,
  StatCard,
  formatDate,
  formatMoney,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  // Next.js 16: route params arrive as a promise.
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: client, error } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-danger">{error.message}</p>;
  }
  if (!client) notFound();

  const typedClient = client as Client;

  const [packsRes, usageRes, leadsRes, portalUsersRes] = await Promise.all([
    db.from("packs").select("*").eq("client_id", id).order("started_at", { ascending: false }),
    db.from("pack_usage").select("*").eq("client_id", id),
    db
      .from("leads")
      .select("*")
      .eq("client_id", id)
      .order("received_at", { ascending: false })
      .limit(50),
    db.from("portal_users").select("id, email, role").eq("client_id", id),
  ]);

  const packs = (packsRes.data ?? []) as Pack[];
  const usage = (usageRes.data ?? []) as PackUsage[];
  const usageByPack = new Map(usage.map((u) => [u.pack_id, u]));
  const leads = (leadsRes.data ?? []) as Lead[];

  const activePack = packs.find((p) => p.status === "active");
  const activeUsage = activePack ? usageByPack.get(activePack.id) : undefined;

  // Lifetime revenue is just the sum of what they've paid for packs —
  // cancelled packs excluded, since those were never delivered against.
  const lifetimeRevenue = packs
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + Number(p.price), 0);

  const totalDelivered = leads.filter((l) => l.counts_against_pack).length;
  const totalReplaced = leads.filter((l) => l.status === "replaced").length;

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/clients" className="text-sm text-muted hover:text-navy">
          ← All clients
        </Link>
      </div>

      <PageHeader
        title={typedClient.business_name}
        subtitle={[typedClient.contact_name, typedClient.region]
          .filter(Boolean)
          .join(" · ")}
        action={
          <ClientStatusControl clientId={typedClient.id} status={typedClient.status} />
        }
      />

      {/* ---- details ---- */}
      <div className="card p-5 mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Detail label="Email" value={typedClient.email} />
          <Detail label="Phone" value={typedClient.phone} />
          <Detail
            label="Service type"
            value={
              typedClient.service_type.charAt(0).toUpperCase() +
              typedClient.service_type.slice(1)
            }
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              GHL tag
            </div>
            {typedClient.ghl_tag_reference ? (
              <Badge tone="brand">{typedClient.ghl_tag_reference}</Badge>
            ) : (
              <Badge tone="danger">Not set — leads can&apos;t route here</Badge>
            )}
          </div>
          {typedClient.postcodes.length > 0 && (
            <Detail label="Postcodes" value={typedClient.postcodes.join(", ")} />
          )}
          {typedClient.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                Internal notes
              </div>
              <p className="text-body whitespace-pre-wrap">{typedClient.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ---- onboarding answers ---- */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-navy">Onboarding</h2>
          {typedClient.onboarding_completed_at ? (
            <Badge tone="ok">Completed {formatDate(typedClient.onboarding_completed_at)}</Badge>
          ) : (
            <Badge tone="warn">Not completed yet</Badge>
          )}
        </div>
        {typedClient.onboarding ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {ONBOARDING.flatMap((section) =>
              section.fields.map((field) => {
                const answer = displayAnswer(field, typedClient.onboarding as Answers);
                if (answer === "—") return null;
                return (
                  <div key={field.key}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                      {field.label}
                    </div>
                    <div className="text-body whitespace-pre-wrap">{answer}</div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            They&apos;ll be asked to fill this in the first time they log in.
          </p>
        )}
      </div>

      {/* ---- portal access ---- */}
      <div className="mb-8">
        <PortalAccess
          clientId={typedClient.id}
          users={
            (portalUsersRes.data ?? []) as {
              id: string;
              email: string;
              role: string;
            }[]
          }
        />
      </div>

      {/* ---- current pack ---- */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-navy">Current pack</h2>
        <NewPackForm clientId={typedClient.id} />
      </div>

      {activePack && activeUsage ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="card p-5 sm:col-span-2">
            <PackBar used={activeUsage.leads_used} size={activeUsage.size} />
            <div className="mt-3 text-xs text-muted">
              Started {formatDate(activePack.started_at)} · {formatMoney(Number(activePack.price))} paid
              {activeUsage.adjustment !== 0 && (
                <> · <span className="text-warn font-semibold">
                  {activeUsage.adjustment > 0 ? "+" : ""}{activeUsage.adjustment} manual adjustment
                </span></>
              )}
            </div>
            <PackUsageEditor
              packId={activePack.id}
              clientId={typedClient.id}
              used={activeUsage.leads_used}
              delivered={activeUsage.leads_delivered}
              size={activeUsage.size}
            />
          </div>
          <StatCard label="Replaced" value={activeUsage.leads_replaced} hint="Not counted" />
          <StatCard
            label="Flagged"
            value={activeUsage.flags_pending}
            hint={activeUsage.flags_pending ? "Awaiting your call" : "Nothing pending"}
            tone={activeUsage.flags_pending ? "warn" : "neutral"}
          />
        </div>
      ) : (
        <div className="card p-5 mb-8 text-sm text-muted">
          No active pack. Incoming leads will still be delivered and visible, but
          won&apos;t count against anything until you start one.
        </div>
      )}

      {/* ---- counting behaviour ---- */}
      <div className="card p-5 mb-8">
        <AutoCountToggle
          clientId={typedClient.id}
          auto={typedClient.auto_count_leads}
        />
      </div>

      {/* ---- pack history ---- */}
      <h2 className="text-lg font-semibold text-navy mb-4">
        Pack history
        <span className="ml-2 text-sm font-normal text-muted">
          {formatMoney(lifetimeRevenue)} lifetime · {totalDelivered} delivered ·{" "}
          {totalReplaced} replaced
        </span>
      </h2>

      {packs.length === 0 ? (
        <div className="card p-5 mb-8 text-sm text-muted">No packs bought yet.</div>
      ) : (
        <div className="card overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left">
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Started</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Used</th>
                <th className="px-4 py-3 font-semibold">Replaced</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => {
                const u = usageByPack.get(pack.id);
                return (
                  <tr key={pack.id} className="border-t border-line">
                    <td className="px-4 py-3 text-body whitespace-nowrap">
                      {formatDate(pack.started_at)}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums">{pack.size}</td>
                    <td className="px-4 py-3 text-body tabular-nums">
                      {u?.leads_used ?? 0}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums">
                      {u?.leads_replaced ?? 0}
                    </td>
                    <td className="px-4 py-3 text-body tabular-nums">
                      {formatMoney(Number(pack.price))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={pack.status === "active" ? "ok" : "neutral"}>
                        {pack.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- leads ---- */}
      <h2 className="text-lg font-semibold text-navy mb-4">
        Recent leads
        {leads.length >= 50 && (
          <span className="ml-2 text-sm font-normal text-muted">(latest 50)</span>
        )}
      </h2>
      <LeadsTable
        leads={leads}
        emptyTitle="No leads delivered yet"
        emptyBody="Once GHL fires a lead carrying this client's tag, it'll appear here."
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
        {label}
      </div>
      <div className="text-body break-words">{value ?? "—"}</div>
    </div>
  );
}
