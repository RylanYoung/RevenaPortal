"use client";

import { useState, useTransition } from "react";
import { assignLead, resolveRequest } from "@/app/admin/actions";

export function AssignLead({
  leadId,
  clients,
}: {
  leadId: string;
  clients: { id: string; business_name: string }[];
}) {
  const [clientId, setClientId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Assign to client"
        className="field w-auto py-2 text-sm"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        disabled={pending}
      >
        <option value="">Assign to…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.business_name}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary btn-sm"
        disabled={!clientId || pending}
        onClick={() => startTransition(() => assignLead(leadId, clientId))}
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
    </div>
  );
}

export function ResolveRequest({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function resolve(decision: "replaced" | "request_declined") {
    startTransition(() => resolveRequest(leadId, decision, note.trim() || null));
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <label className="label" htmlFor={`note-${leadId}`}>
        Your note <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={`note-${leadId}`}
        rows={2}
        className="field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why you're approving or declining this…"
        disabled={pending}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() => resolve("replaced")}
        >
          Approve replacement
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => resolve("request_declined")}
        >
          Decline request
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Approving credits the lead back — it stops counting against their pack.
        Declining leaves it counted.
      </p>
    </div>
  );
}
