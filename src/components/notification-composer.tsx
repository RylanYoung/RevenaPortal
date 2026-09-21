"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { sendNotification, deleteNotification } from "@/app/admin/actions";

type ClientOption = { id: string; business_name: string };

export function NotificationComposer({ clients }: { clients: ClientOption[] }) {
  const [result, formAction, pending] = useActionState(sendNotification, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once it's away, so the same message isn't sitting there
  // ready to be sent a second time.
  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-navy mb-1">Send a message</h2>
      <p className="text-sm text-muted mb-5">
        Appears in the client&apos;s portal next time they open it. No email is
        sent.
      </p>

      <form ref={formRef} action={formAction} className="grid gap-4">
        <div>
          <label className="label" htmlFor="client_id">
            Who gets it
          </label>
          <select id="client_id" name="client_id" defaultValue="all" className="field">
            <option value="all">Everyone</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            className="field"
            placeholder="Leads paused over the long weekend"
          />
        </div>

        <div>
          <label className="label" htmlFor="body">
            Message
          </label>
          <textarea
            id="body"
            name="body"
            required
            rows={4}
            className="field"
            placeholder="We'll be back to normal delivery on Tuesday…"
          />
        </div>

        {result?.ok && (
          <p className="text-sm text-ok font-semibold animate-fade-in">Sent.</p>
        )}
        {result && !result.ok && (
          <p className="text-sm text-danger">{result.error}</p>
        )}

        <div>
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DeleteNotification({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => deleteNotification(id))}
      className="text-xs text-muted hover:text-danger transition-colors"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
