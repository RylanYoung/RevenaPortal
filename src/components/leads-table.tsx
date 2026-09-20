import Link from "next/link";
import type { Lead } from "@/lib/types";
import { LeadStatusBadge, EmptyState, formatDateTime } from "./ui";

/**
 * Shared lead table. Used on the all-leads view and on a client's detail page;
 * `showClient` is what differs between them.
 */
export function LeadsTable({
  leads,
  clientNames,
  showClient = false,
  emptyTitle = "No leads yet",
  emptyBody,
}: {
  leads: Lead[];
  clientNames?: Map<string, string>;
  showClient?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (leads.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel text-left">
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Received</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              {showClient && <th className="px-4 py-3 font-semibold">Client</th>}
              <th className="px-4 py-3 font-semibold">Postcode</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-line align-top">
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {formatDateTime(lead.received_at)}
                </td>
                <td className="px-4 py-3 font-medium text-navy">
                  {lead.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-body">
                  <div>{lead.phone ?? "—"}</div>
                  {lead.email && (
                    <div className="text-xs text-muted truncate max-w-[200px]">
                      {lead.email}
                    </div>
                  )}
                </td>
                {showClient && (
                  <td className="px-4 py-3">
                    {lead.client_id ? (
                      <Link
                        href={`/admin/clients/${lead.client_id}`}
                        className="text-blue hover:underline"
                      >
                        {clientNames?.get(lead.client_id) ?? "Unknown"}
                      </Link>
                    ) : (
                      <Link
                        href="/admin/unassigned"
                        className="text-warn font-semibold hover:underline"
                      >
                        Unassigned
                      </Link>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-body">{lead.postcode ?? "—"}</td>
                <td className="px-4 py-3 text-body capitalize">
                  {lead.lead_type ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted max-w-[180px] truncate">
                  {lead.source ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <LeadStatusBadge status={lead.status} />
                  {/* The client's reason matters most when a request is open. */}
                  {lead.flag_reason && lead.status === "replacement_requested" && (
                    <div className="mt-1 text-xs text-muted max-w-[180px]">
                      {lead.flag_reason}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
