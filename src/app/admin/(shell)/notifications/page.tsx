import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Client } from "@/lib/types";
import {
  NotificationComposer,
  DeleteNotification,
} from "@/components/notification-composer";
import { PageHeader, Badge, EmptyState, formatDateTime } from "@/components/ui";

export const dynamic = "force-dynamic";

type Notification = {
  id: string;
  client_id: string | null;
  title: string;
  body: string;
  created_at: string;
};

export default async function NotificationsPage() {
  const db = supabaseAdmin();

  const [clientsRes, sentRes, readsRes] = await Promise.all([
    db.from("clients").select("id, business_name").order("business_name"),
    db.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
    db.from("notification_reads").select("notification_id"),
  ]);

  const clients = (clientsRes.data ?? []) as Pick<Client, "id" | "business_name">[];
  const names = new Map(clients.map((c) => [c.id, c.business_name]));
  const sent = (sentRes.data ?? []) as Notification[];

  // How many people have opened each one — worth knowing before you chase
  // someone about something they never saw.
  const readCounts = new Map<string, number>();
  for (const r of (readsRes.data ?? []) as { notification_id: string }[]) {
    readCounts.set(r.notification_id, (readCounts.get(r.notification_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Notices shown to clients inside the portal."
      />

      <div className="mb-8">
        <NotificationComposer clients={clients} />
      </div>

      <h2 className="text-lg font-semibold text-navy mb-4">Sent</h2>

      {sent.length === 0 ? (
        <EmptyState title="Nothing sent yet">
          Anything you send appears on the client&apos;s dashboard until they
          dismiss it.
        </EmptyState>
      ) : (
        <div className="grid gap-3 stagger">
          {sent.map((n) => {
            const reads = readCounts.get(n.id) ?? 0;
            return (
              <div key={n.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-navy">{n.title}</span>
                      <Badge tone={n.client_id ? "brand" : "neutral"}>
                        {n.client_id
                          ? names.get(n.client_id) ?? "Unknown client"
                          : "Everyone"}
                      </Badge>
                    </div>
                    <p className="text-sm text-body mt-2 whitespace-pre-wrap">
                      {n.body}
                    </p>
                    <div className="text-xs text-muted mt-2">
                      {formatDateTime(n.created_at)} ·{" "}
                      {reads === 0 ? "not opened yet" : `opened by ${reads}`}
                    </div>
                  </div>
                  <DeleteNotification id={n.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
