"use client";

import { useActionState, useState, useTransition } from "react";
import { createPack, setClientStatus } from "@/app/admin/actions";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/types";

export function ClientStatusControl({
  clientId,
  status,
}: {
  clientId: string;
  status: ClientStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-muted" htmlFor="client-status">
        Status
      </label>
      <select
        id="client-status"
        className="field w-auto py-1.5 text-sm"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ClientStatus;
          startTransition(() => setClientStatus(clientId, next));
        }}
      >
        {CLIENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NewPackForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [result, formAction, pending] = useActionState(createPack, null);

  if (result?.ok && open) setOpen(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
        Add pack
      </button>
    );
  }

  return (
    <form action={formAction} className="card p-5 w-full">
      <input type="hidden" name="client_id" value={clientId} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-navy">New pack</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-navy"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-muted mb-4">
        Starting a new pack closes the current one. Leads delivered from now on count
        against this one instead.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="size">
            Pack size *
          </label>
          <input id="size" name="size" type="number" min="1" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="price">
            Price paid (AUD)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="started_at">
            Start date
          </label>
          <input id="started_at" name="started_at" type="date" className="field" />
        </div>
      </div>

      {result && !result.ok && (
        <p className="mt-3 text-sm text-danger">{result.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-sm mt-4">
        {pending ? "Saving…" : "Start pack"}
      </button>
    </form>
  );
}
