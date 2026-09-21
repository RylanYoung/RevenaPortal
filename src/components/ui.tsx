import type { ReactNode } from "react";
import { LEAD_STATUS_LABELS, type LeadStatus, type ClientStatus } from "@/lib/types";

/** Tone drives colour so badges stay consistent wherever they appear. */
type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-panel text-muted",
  brand: "bg-blue-tint text-blue",
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  danger: "bg-danger-tint text-danger",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  delivered: "brand",
  replacement_requested: "warn",
  replaced: "neutral",
  request_declined: "ok",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_STATUS_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

const CLIENT_STATUS_TONE: Record<ClientStatus, Tone> = {
  active: "ok",
  paused: "warn",
  churned: "danger",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge tone={CLIENT_STATUS_TONE[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-bold tabular-nums ${
          tone === "warn" ? "text-warn" : "text-navy"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

/** Pack usage bar. Overflow (used > size) is shown in the warn colour. */
export function PackBar({ used, size }: { used: number; size: number }) {
  const pct = size > 0 ? Math.min((used / size) * 100, 100) : 0;
  const over = used > size;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-navy tabular-nums">
          {used} of {size}
        </span>
        <span className={`text-xs ${over ? "text-warn font-semibold" : "text-muted"}`}>
          {over ? `${used - size} over` : `${size - used} left`}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-panel overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-warn" : "bg-blue"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Dates are rendered in Australian format — every client is local. */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-AU", {
    // Vercel runs in UTC. Without an explicit zone every date renders
    // 10 hours out for an Australian reader — a lead that arrived at 9am
    // would show as 11pm the day before.
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-AU", {
    // Vercel runs in UTC. Without an explicit zone every date renders
    // 10 hours out for an Australian reader — a lead that arrived at 9am
    // would show as 11pm the day before.
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}
