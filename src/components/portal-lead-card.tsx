"use client";

import { useActionState, useState } from "react";
import { flagLead, saveCrm } from "@/app/portal/actions";
import {
  FLAG_REASONS,
  OUTCOMES,
  OUTCOME_LABELS,
  type Lead,
} from "@/lib/types";
import { LeadStatusBadge, Badge, formatDateTime, formatDate } from "./ui";

export function PortalLeadCard({ lead }: { lead: Lead }) {
  const [openPanel, setOpenPanel] = useState<"none" | "crm" | "flag">("none");

  const [crmResult, crmAction, crmPending] = useActionState(saveCrm, null);
  const [flagResult, flagAction, flagPending] = useActionState(flagLead, null);

  // Close the flag panel once it's been raised — the status badge above now
  // tells the story, and leaving the form open invites a second submission.
  if (flagResult?.ok && openPanel === "flag") setOpenPanel("none");

  const canFlag = lead.status === "delivered";

  return (
    <div className="card p-6">
      {/* ---- the lead itself ---- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold">{lead.name ?? "New lead"}</h3>

          <div className="mt-2 flex flex-col gap-1 text-base">
            {lead.phone && (
              // Tap-to-call: most of these get actioned from a phone.
              <a
                href={`tel:${lead.phone.replace(/\s/g, "")}`}
                className="text-blue font-semibold hover:underline w-fit"
              >
                {lead.phone}
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="text-body hover:text-blue break-all w-fit"
              >
                {lead.email}
              </a>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{formatDateTime(lead.received_at)}</span>
            {lead.postcode && <span>· {lead.postcode}</span>}
            {lead.lead_type && <span className="capitalize">· {lead.lead_type}</span>}
            {lead.source && <span>· {lead.source}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <LeadStatusBadge status={lead.status} />
          {lead.outcome && (
            <Badge tone={lead.outcome === "won" ? "ok" : "neutral"}>
              {OUTCOME_LABELS[lead.outcome]}
            </Badge>
          )}
        </div>
      </div>

      {/* ---- what's already been said about this lead ---- */}
      {lead.status === "replacement_requested" && (
        <p className="mt-4 rounded-xl bg-warn-tint px-4 py-3 text-sm text-warn animate-fade-in">
          You&apos;ve reported this one{lead.flag_reason ? `: ${lead.flag_reason}` : ""}.
          We&apos;re reviewing it — nothing to do from here.
        </p>
      )}
      {lead.status === "replaced" && (
        <p className="mt-4 rounded-xl bg-panel px-4 py-3 text-sm text-body animate-fade-in">
          Replaced — this one doesn&apos;t count against your pack.
        </p>
      )}
      {lead.status === "request_declined" && (
        <p className="mt-4 rounded-xl bg-panel px-4 py-3 text-sm text-body animate-fade-in">
          We reviewed your report and this lead still counts.
          {lead.resolution_note ? ` ${lead.resolution_note}` : ""}
        </p>
      )}

      {/* ---- toggles ---- */}
      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
        <button
          onClick={() => setOpenPanel(openPanel === "crm" ? "none" : "crm")}
          className="btn btn-ghost btn-sm"
        >
          {openPanel === "crm" ? "Close" : "Track this lead"}
          <span
            className={`transition-transform duration-200 ${
              openPanel === "crm" ? "rotate-90" : ""
            }`}
          >
            →
          </span>
        </button>

        {canFlag && (
          <button
            onClick={() => setOpenPanel(openPanel === "flag" ? "none" : "flag")}
            className="text-sm text-muted hover:text-danger transition-colors"
          >
            {openPanel === "flag" ? "Cancel" : "Report a problem"}
          </button>
        )}
      </div>

      {/* ---- optional CRM panel ---- */}
      {openPanel === "crm" && (
        <form action={crmAction} className="mt-5 animate-fade-up">
          <input type="hidden" name="lead_id" value={lead.id} />

          <p className="text-sm text-muted mb-4">
            Just for you — keep track of where this one&apos;s up to. Nothing here
            affects your pack.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`outcome-${lead.id}`}>
                Where&apos;s it at?
              </label>
              <select
                id={`outcome-${lead.id}`}
                name="outcome"
                defaultValue={lead.outcome ?? ""}
                className="field"
              >
                <option value="">Not set</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor={`follow-${lead.id}`}>
                Follow up on
              </label>
              <input
                id={`follow-${lead.id}`}
                name="follow_up_date"
                type="date"
                defaultValue={lead.follow_up_date ?? ""}
                className="field"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor={`notes-${lead.id}`}>
                Your notes
              </label>
              <textarea
                id={`notes-${lead.id}`}
                name="crm_notes"
                rows={3}
                defaultValue={lead.crm_notes ?? ""}
                className="field"
                placeholder="Quoted $8,400 — calling back Tuesday…"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={crmPending} className="btn btn-primary btn-sm">
              {crmPending ? "Saving…" : "Save"}
            </button>
            {crmResult?.ok && (
              <span className="text-sm text-ok font-semibold animate-fade-in">
                Saved
              </span>
            )}
            {crmResult && !crmResult.ok && (
              <span className="text-sm text-danger">{crmResult.error}</span>
            )}
          </div>
        </form>
      )}

      {/* ---- flag panel ---- */}
      {openPanel === "flag" && (
        <form action={flagAction} className="mt-5 animate-fade-up">
          <input type="hidden" name="lead_id" value={lead.id} />

          <p className="text-sm text-muted mb-4">
            Tell us what went wrong and we&apos;ll take a look. We&apos;ll come back
            to you — nothing changes on your pack until we do.
          </p>

          <label className="label" htmlFor={`reason-${lead.id}`}>
            What was wrong?
          </label>
          <select
            id={`reason-${lead.id}`}
            name="flag_reason"
            required
            defaultValue=""
            className="field"
          >
            <option value="" disabled>
              Choose a reason…
            </option>
            {FLAG_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label className="label mt-4" htmlFor={`flagnote-${lead.id}`}>
            Anything else? <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`flagnote-${lead.id}`}
            name="flag_note"
            rows={3}
            className="field"
            placeholder="Called 4 times over 3 days, number goes to voicemail…"
          />

          {flagResult && !flagResult.ok && (
            <p className="mt-3 text-sm text-danger">{flagResult.error}</p>
          )}

          <button
            type="submit"
            disabled={flagPending}
            className="btn btn-primary btn-sm mt-4"
          >
            {flagPending ? "Sending…" : "Send report"}
          </button>
        </form>
      )}

      {/* A follow-up date the client set is worth surfacing without opening
          the panel — otherwise they'd have to expand every card to find it. */}
      {lead.follow_up_date && openPanel !== "crm" && (
        <p className="mt-3 text-sm text-muted">
          Follow up {formatDate(lead.follow_up_date)}
        </p>
      )}
    </div>
  );
}
