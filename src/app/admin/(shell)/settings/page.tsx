import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const mcpUrl = `${proto}://${host}/api/mcp`;
  // Only presence is checked — the key belongs in the Authorization header,
  // never in a URL, so it is deliberately not rendered here.
  const mcpConfigured = Boolean(process.env.MCP_API_KEY);

  return (
    <>
      <PageHeader title="Settings" subtitle="How the portal looks, and how Claude connects to it." />

      {/* ---- appearance ---- */}
      <section className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-navy mb-1">Appearance</h2>
        <p className="text-sm text-muted mb-5">
          Applies to this browser only — it&apos;s remembered on this device and
          doesn&apos;t change what your clients see.
        </p>
        <ThemeToggle />
      </section>

      {/* ---- MCP ---- */}
      <section className="card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h2 className="text-lg font-semibold text-navy">Claude MCP server</h2>
          {mcpConfigured ? (
            <Badge tone="ok">Ready</Badge>
          ) : (
            <Badge tone="danger">MCP_API_KEY not set</Badge>
          )}
        </div>
        <p className="text-sm text-muted mb-5">
          Connect this and you can onboard clients, check packs and read the
          replacement queue by asking Claude, instead of clicking through here.
        </p>

        <div className="mb-5">
          <div className="label">Server URL</div>
          <CopyField value={mcpUrl} />
        </div>

        <div className="rounded-xl bg-panel border border-line p-5 mb-5">
          <div className="text-sm font-semibold text-navy mb-3">How to connect</div>
          <ol className="text-sm text-body space-y-2 list-decimal pl-5">
            <li>In Claude: <strong>Settings → Connectors → Add custom connector</strong></li>
            <li>Paste the server URL above</li>
            <li>
              Set authentication to <strong>Bearer token</strong> and paste your{" "}
              <code>MCP_API_KEY</code> (it&apos;s in your Vercel environment
              variables, and in <code>.env.local</code> for local work)
            </li>
          </ol>
        </div>

        <div className="mb-5">
          <div className="label">What Claude can do once connected</div>
          <ul className="text-sm text-body space-y-1.5">
            <li>
              <code>create_client</code> — onboard a business, open their first pack,
              optionally send their portal invite
            </li>
            <li>
              <code>get_client</code> — status, pack usage and recent leads for one client
            </li>
            <li>
              <code>list_clients</code> — the full roster with pack usage
            </li>
            <li>
              <code>update_client_pack</code> — record a renewal; closes the old pack,
              opens the new one
            </li>
            <li>
              <code>get_dispute_queue</code> — replacement requests waiting on you
            </li>
          </ul>
        </div>

        <p className="text-sm text-warn">
          <strong>This token is admin-scoped.</strong> It isn&apos;t limited to one
          client the way a client login is — anything holding it can read and change
          every client&apos;s data. Treat it like a password.
        </p>
      </section>

      {/* ---- pointer to the webhook page ---- */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-navy mb-1">Lead intake</h2>
        <p className="text-sm text-muted mb-4">
          Your GHL webhook URL, the tags currently in use, and a test command live on
          their own page.
        </p>
        <Link href="/admin/setup" className="btn btn-ghost btn-sm">
          Webhook setup
        </Link>
      </section>
    </>
  );
}
