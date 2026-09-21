"use client";

import { useActionState, useState, useTransition } from "react";
import { createPack, setClientStatus, setPackUsage } from "@/app/admin/actions";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/types";

/**
 * Lets you correct the used count on a pack — for leads delivered before the
 * portal existed, or sent by another route, or a figure that's simply wrong.
 */
export function PackUsageEditor({
  packId,
  clientId,
  used,
  delivered,
  size,
}: {
  packId: string;
  clientId: string;
  used: number;
  delivered: number;
  size: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(used));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => {
          setValue(String(used));
          setOpen(true);
        }}
        className="text-xs text-muted hover:text-navy transition-colors"
      >
        Adjust count
      </button>
    );
  }

  function save() {
    const n = Number(value);
    start(async () => {
      const r = await setPackUsage(packId, clientId, n);
      if (r.ok) {
        setOpen(false);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <label className="label" htmlFor={`used-${packId}`}>
        Leads used
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`used-${packId}`}
          type="number"
          min={0}
          max={size * 10}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field w-28"
          disabled={pending}
        />
        <button onClick={save} disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-muted hover:text-navy"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {delivered} delivered through the system. Setting a different number keeps
        that figure and records the difference as a manual adjustment.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

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
