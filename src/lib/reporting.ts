import type { Lead } from "./types";

export type MonthBucket = {
  key: string; // "2026-09"
  label: string; // "Sep"
  fullLabel: string; // "September 2026"
  total: number;
  counted: number; // leads that count against a pack
  replaced: number; // credited back, don't count
  won: number;
  tracked: number; // leads with any outcome set
};

/**
 * Buckets leads into the last `months` calendar months, most recent last.
 *
 * Months with no leads are kept rather than skipped — a gap in delivery is
 * information, and dropping empty months would silently compress the x-axis
 * and make an inconsistent month look like a consistent one.
 */
export function bucketByMonth(leads: Lead[], months = 12): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  const index = new Map<string, MonthBucket>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket: MonthBucket = {
      key,
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      fullLabel: d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
      total: 0,
      counted: 0,
      replaced: 0,
      won: 0,
      tracked: 0,
    };
    buckets.push(bucket);
    index.set(key, bucket);
  }

  for (const lead of leads) {
    const d = new Date(lead.received_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = index.get(key);
    if (!bucket) continue; // Older than the window.

    bucket.total++;
    if (lead.status === "replaced") bucket.replaced++;
    else bucket.counted++;
    if (lead.outcome) bucket.tracked++;
    if (lead.outcome === "won") bucket.won++;
  }

  return buckets;
}

export type Totals = {
  total: number;
  counted: number;
  replaced: number;
  won: number;
  tracked: number;
  /** won / tracked — null when they haven't used the CRM section at all. */
  closeRate: number | null;
  /** replaced / total — null with no leads. */
  replacementRate: number | null;
};

export function summarise(leads: Lead[]): Totals {
  const total = leads.length;
  const replaced = leads.filter((l) => l.status === "replaced").length;
  const tracked = leads.filter((l) => l.outcome).length;
  const won = leads.filter((l) => l.outcome === "won").length;

  return {
    total,
    counted: total - replaced,
    replaced,
    won,
    tracked,
    // Rate is against TRACKED leads, not all leads — dividing by every lead
    // would report a close rate of near-zero for someone who only tracked a
    // handful, which reads as a failure rather than as missing data.
    closeRate: tracked > 0 ? won / tracked : null,
    replacementRate: total > 0 ? replaced / total : null,
  };
}

/** RFC 4180 escaping — leads carry commas, quotes and newlines in notes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    "Received",
    "Name",
    "Phone",
    "Email",
    "Postcode",
    "Type",
    "Source",
    "Status",
    "Counts against pack",
    "Your outcome",
    "Your notes",
    "Follow up",
  ];

  const rows = leads.map((l) => [
    new Date(l.received_at).toISOString(),
    l.name,
    l.phone,
    l.email,
    l.postcode,
    l.lead_type,
    l.source,
    l.status,
    l.counts_against_pack ? "Yes" : "No",
    l.outcome,
    l.crm_notes,
    l.follow_up_date,
  ]);

  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
