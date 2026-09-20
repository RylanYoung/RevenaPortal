import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client } from "@/lib/types";
import { PageHeader, Badge } from "@/components/ui";
import { CopyField } from "@/components/copy-field";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Next.js 16: headers() is async.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const secret = process.env.GHL_WEBHOOK_SECRET;
  const webhookUrl = `${proto}://${host}/api/webhooks/ghl?key=${secret ?? "<GHL_WEBHOOK_SECRET not set>"}`;

  // The MCP key is never put in the URL — it goes in the Authorization header,
  // so only its presence is checked here.
  const mcpKey = Boolean(process.env.MCP_API_KEY);
  const mcpUrl = `${proto}://${host}/api/mcp`;

  const db = supabaseAdmin();
  const { data } = await db
    .from("clients")
    .select("id, business_name, ghl_tag_reference, status")
    .order("business_name");
  const clients = (data ?? []) as Pick<
    Client,
    "id" | "business_name" | "ghl_tag_reference" | "status"
  >[];

  return (
    <>
      <PageHeader
        title="Webhook setup"
        subtitle="One URL, pasted into every GHL automation that fires a qualified lead."
      />

      {!secret && (
        <p className="card p-4 mb-6 text-sm text-danger">
          <code>GHL_WEBHOOK_SECRET</code> isn&apos;t set. Until it is, the endpoint
          rejects everything — it fails closed on purpose. Add it to{" "}
          <code>.env.local</code> and to Vercel.
        </p>
      )}

      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-navy mb-1">Your intake URL</h2>
        <p className="text-sm text-muted mb-4">
          In GHL: add a <strong>Webhook</strong> action to the workflow, method{" "}
          <strong>POST</strong>, and paste this as the URL. Leave the body as the
          default contact payload.
        </p>
        <CopyField value={webhookUrl} />
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-navy mb-3">How a lead finds its client</h2>
        <ol className="text-sm text-body space-y-2 list-decimal pl-5">
          <li>
            GHL fires the webhook <strong>on qualification</strong>, not on contact
            creation — so unqualified leads never reach a client or touch a pack.
          </li>
          <li>
            The payload carries the contact&apos;s tags. Whichever tag matches a
            client&apos;s <strong>GHL tag</strong> decides who receives it.
          </li>
          <li>
            No match, or tags for two different clients, and the lead lands in{" "}
            <strong>Unassigned</strong> for you to place. It is never dropped.
          </li>
          <li>
            The same GHL contact delivered twice is ignored the second time, so
            retries and double-firing automations can&apos;t double-charge a pack.
          </li>
        </ol>
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-navy mb-3">Tags in use</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted">No clients yet.</p>
        ) : (
          <div className="grid gap-2">
            {clients.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 border-b border-line last:border-0 py-2"
              >
                <span className="text-sm text-navy font-medium">{c.business_name}</span>
                {c.ghl_tag_reference ? (
                  <Badge tone={c.status === "active" ? "brand" : "neutral"}>
                    {c.ghl_tag_reference}
                  </Badge>
                ) : (
                  <Badge tone="danger">No tag — can&apos;t receive leads</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-navy mb-1">Claude MCP server</h2>
        <p className="text-sm text-muted mb-4">
          Add this as a custom connector in Claude (Settings → Connectors → Add
          custom connector) and you can onboard clients, check packs and read the
          dispute queue from a chat.
        </p>
        {mcpKey ? (
          <>
            <CopyField value={mcpUrl} />
            <p className="mt-3 text-sm text-muted">
              Auth: <strong>Bearer token</strong> — use your{" "}
              <code>MCP_API_KEY</code>. It&apos;s admin-scoped and reaches every
              client&apos;s data, so treat it like a password.
            </p>
          </>
        ) : (
          <p className="text-sm text-danger">
            <code>MCP_API_KEY</code> isn&apos;t set, so the endpoint rejects
            everything. Add it to <code>.env.local</code> and to Vercel.
          </p>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-navy mb-3">Test it without GHL</h2>
        <p className="text-sm text-muted mb-4">
          Run this to fire a fake lead at the endpoint. Swap the tag for a real
          client&apos;s tag to watch it route. Change{" "}
          <code>contact_id</code> each run — reuse the same one and the endpoint
          correctly treats it as a duplicate and ignores it.
        </p>
        <CopyField
          multiline
          value={`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact_id": "test-lead-1",
    "first_name": "Test",
    "last_name": "Lead",
    "email": "test@example.com",
    "phone": "0400 000 000",
    "postal_code": "4000",
    "tags": ["${clients.find((c) => c.ghl_tag_reference)?.ghl_tag_reference ?? "your-client-tag"}"],
    "source": "Manual test"
  }'`}
        />
      </div>
    </>
  );
}
