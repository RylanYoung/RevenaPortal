import { currentPortalUser, supabaseServer } from "@/lib/supabase-server";
import type { Pack, PackUsage } from "@/lib/types";
import { formatDate } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await currentPortalUser();
  if (!session?.client) return null;

  const client = session.client;
  const db = await supabaseServer();

  const [packsRes, usageRes] = await Promise.all([
    db.from("packs").select("*").order("started_at", { ascending: false }),
    db.from("pack_usage").select("*"),
  ]);

  const packs = (packsRes.data ?? []) as Pack[];
  const usage = new Map(
    ((usageRes.data ?? []) as PackUsage[]).map((u) => [u.pack_id, u])
  );

  return (
    <>
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl sm:text-4xl">Account</h1>
        <p className="text-lg text-muted mt-1">Your details and pack history.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 stagger">
        <div className="card p-6">
          <h2 className="text-xl mb-5">Your details</h2>
          <dl className="grid gap-4">
            <Row label="Business" value={client.business_name} />
            <Row label="Contact" value={client.contact_name} />
            <Row label="Email" value={client.email} />
            <Row label="Phone" value={client.phone} />
            <Row
              label="Service type"
              value={
                client.service_type.charAt(0).toUpperCase() +
                client.service_type.slice(1)
              }
            />
            <Row label="Area" value={client.region} />
          </dl>
          <p className="mt-6 text-sm text-muted">
            Something not right? Let us know and we&apos;ll update it.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl mb-2">Appearance</h2>
          <p className="text-sm text-muted mb-5">
            Remembered on this device.
          </p>
          <ThemeToggle />
        </div>

        <div className="card p-6">
          <h2 className="text-xl mb-5">Need a hand?</h2>
          <p className="text-body">
            Questions about a lead, your pack, or anything else — get in touch and
            we&apos;ll come straight back to you.
          </p>
          <a href="mailto:hello@revenamedia.com" className="btn btn-primary mt-5">
            Email Revena Media
          </a>
          <p className="mt-6 text-sm text-muted">
            You&apos;re logged in as {session.portalUser?.email}.
          </p>
        </div>
      </div>

      <h2 className="text-2xl mt-10 mb-4">Pack history</h2>

      {packs.length === 0 ? (
        <div className="card p-6 text-body">No packs yet.</div>
      ) : (
        <div className="grid gap-3 stagger">
          {packs.map((pack) => {
            const u = usage.get(pack.id);
            return (
              <div
                key={pack.id}
                className="card p-5 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="text-lg font-semibold text-navy">
                    {pack.size} leads
                  </div>
                  <div className="text-sm text-muted">
                    Started {formatDate(pack.started_at)}
                    {pack.ended_at ? ` · ended ${formatDate(pack.ended_at)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-navy tabular-nums">
                    {u?.leads_used ?? 0} / {pack.size}
                  </div>
                  <div className="text-sm text-muted">
                    {pack.status === "active" ? "Current pack" : "Finished"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="text-lg text-navy mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
