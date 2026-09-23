"use client";

import { useActionState, useState, useTransition } from "react";
import { flagLead, setOutcome, saveNote } from "@/app/portal/actions";
import {
  FLAG_REASONS,
  OUTCOMES,
  OUTCOME_LABELS,
  type Lead,
  type Outcome,
} from "@/lib/types";
import { extraDetails } from "@/lib/lead-details";
import { LeadStatusBadge, formatDateTime, formatDate } from "./ui";

/**
 * One lead, as the client sees it.
 *
 * The CRM used to be two nested panels behind two toggles — open "Track this
 * lead", pick from a dropdown, find Save. Setting a status is now one tap on
 * the card itself, which is the thing a client does most and should cost the
 * least.
 */
export function PortalLeadCard({ lead }: { lead: Lead }) {
  const [showNote, setShowNote] = useState(false);
  const [showFlag, setShowFlag] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Optimistic: the pill highlights the moment it's tapped.
  const [outcome, setLocalOutcome] = useState<Outcome | null>(lead.outcome);
  const [, startOutcome] = useTransition();

  const [noteResult, noteAction, notePending] = useActionState(saveNote, null);
  const [flagResult, flagAction, flagPending] = useActionState(flagLead, null);

  if (flagResult?.ok && showFlag) setShowFlag(false);
  if (noteResult?.ok && showNote) setShowNote(false);

  const canFlag = lead.status === "delivered";
  const details = extraDetails(lead);

  function pick(next: Outcome) {
    const value = outcome === next ? null : next; // Tapping again clears it.
    setLocalOutcome(value);
    startOutcome(() => setOutcome(lead.id, value));
  }

  return (
    <div className="card p-6">
      {/* ---- the lead ---- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold">{lead.name ?? "New lead"}</h3>

          <div className="mt-2 flex flex-col gap-1 text-base">
            {lead.phone && (
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

        <LeadStatusBadge status={lead.status} />
      </div>

      {/* ---- everything else GHL sent ---- */}
      {details.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            {showDetails ? "Hide details" : `View all details (${details.length})`}
          </button>
          {showDetails && (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 rounded-xl bg-panel p-4 animate-fade-in">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {d.label}
                  </dt>
                  <dd className="text-body break-words">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* ---- what's already been said ---- */}
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

      {/* ---- one-tap status ---- */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="text-sm text-muted mb-3">Where&apos;s it at?</div>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => {
            const on = outcome === o;
            return (
              <button
                key={o}
                onClick={() => pick(o)}
                aria-pressed={on}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  on
                    ? "bg-blue text-white"
                    : "bg-panel text-body hover:text-navy"
                }`}
              >
                {OUTCOME_LABELS[o]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- notes ---- */}
      {lead.crm_notes && !showNote && (
        <div className="mt-4 rounded-xl bg-panel px-4 py-3 text-sm text-body whitespace-pre-wrap">
          {lead.crm_notes}
        </div>
      )}
      {lead.follow_up_date && !showNote && (
        <p className="mt-3 text-sm text-muted">
          Follow up {formatDate(lead.follow_up_date)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={() => setShowNote((v) => !v)}
          className="btn btn-ghost btn-sm"
        >
          {showNote ? "Cancel" : lead.crm_notes ? "Edit notes" : "Add a note"}
        </button>
        {canFlag && (
          <button
            onClick={() => setShowFlag((v) => !v)}
            className="text-sm text-muted hover:text-danger transition-colors"
          >
            {showFlag ? "Cancel" : "Report a problem"}
          </button>
        )}
      </div>

      {showNote && (
        <form action={noteAction} className="mt-4 animate-fade-up">
          <input type="hidden" name="lead_id" value={lead.id} />
          <textarea
            name="crm_notes"
            rows={3}
            defaultValue={lead.crm_notes ?? ""}
            className="field"
            placeholder="Quoted $8,400 — calling back Tuesday…"
          />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor={`follow-${lead.id}`}>
                Remind me on
              </label>
              <input
                id={`follow-${lead.id}`}
                name="follow_up_date"
                type="date"
                defaultValue={lead.follow_up_date ?? ""}
                className="field w-auto"
              />
            </div>
            <button type="submit" disabled={notePending} className="btn btn-primary btn-sm">
              {notePending ? "Saving…" : "Save"}
            </button>
          </div>
          {noteResult && !noteResult.ok && (
            <p className="mt-2 text-sm text-danger">{noteResult.error}</p>
          )}
        </form>
      )}

      {showFlag && (
        <form action={flagAction} className="mt-4 animate-fade-up">
          <input type="hidden" name="lead_id" value={lead.id} />
          <p className="text-sm text-muted mb-3">
            Only for leads we shouldn&apos;t have sent — wrong area, bad number,
            fake details. We&apos;ll look into it and come back to you.
          </p>

          <select name="flag_reason" required defaultValue="" className="field">
            <option value="" disabled>
              What was wrong?
            </option>
            {FLAG_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <textarea
            name="flag_note"
            rows={2}
            className="field mt-3"
            placeholder="Anything else? e.g. the number rings out to a disconnected message"
          />

          {flagResult && !flagResult.ok && (
            <p className="mt-3 text-sm text-danger">{flagResult.error}</p>
          )}

          <button
            type="submit"
            disabled={flagPending}
            className="btn btn-primary btn-sm mt-3"
          >
            {flagPending ? "Sending…" : "Send report"}
          </button>
        </form>
      )}
    </div>
  );
}
