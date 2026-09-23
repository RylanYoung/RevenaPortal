"use client";

import { useState, useTransition } from "react";
import { setLeadCounts, setAutoCount } from "@/app/admin/actions";

/**
 * One-click control over whether a lead counts against its client's pack.
 *
 * Shows the state as a pill you toggle rather than a checkbox, because the
 * state itself is the thing worth reading at a glance down a list of leads.
 */
export function CountToggle({
  leadId,
  clientId,
  counts,
  replaced,
}: {
  leadId: string;
  clientId: string | null;
  counts: boolean;
  replaced: boolean;
}) {
  const [on, setOn] = useState(counts);
  const [pending, start] = useTransition();

  // A replaced lead is already off the count for a reason that has its own
  // record. Letting this toggle fight that would make the pack unexplainable.
  if (replaced) {
    return <span className="text-xs text-muted whitespace-nowrap">Replaced</span>;
  }

  return (
    <button
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next); // Optimistic — the row shouldn't sit there looking stuck.
        start(() => setLeadCounts(leadId, next, clientId));
      }}
      title={on ? "Counts against their pack — click to exclude" : "Not counted — click to accept"}
      className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
        on
          ? "bg-ok-tint text-ok hover:bg-warn-tint hover:text-warn"
          : "bg-warn-tint text-warn hover:bg-ok-tint hover:text-ok"
      }`}
    >
      {on ? "Counts" : "Not counted"}
    </button>
  );
}

/** Whether a client's incoming leads count on arrival or wait for review. */
export function AutoCountToggle({
  clientId,
  auto,
}: {
  clientId: string;
  auto: boolean;
}) {
  const [on, setOn] = useState(auto);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-navy">
          New leads count automatically
        </div>
        <div className="text-xs text-muted mt-0.5">
          {on
            ? "Leads count against their pack the moment they arrive. You can still exclude any one of them."
            : "Leads arrive without counting. You accept each one before it goes on their pack."}
        </div>
      </div>
      <button
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          start(() => setAutoCount(clientId, next));
        }}
        aria-pressed={on}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? "bg-blue" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            on ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
