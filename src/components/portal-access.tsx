"use client";

import { useActionState, useState, useTransition } from "react";
import {
  invitePortalUser,
  removePortalUser,
  sendPasswordReset,
} from "@/app/admin/actions";

type PortalUser = { id: string; email: string; role: string };

export function PortalAccess({
  clientId,
  users,
}: {
  clientId: string;
  users: PortalUser[];
}) {
  const [result, formAction, pending] = useActionState(invitePortalUser, null);
  const [removing, startRemove] = useTransition();
  // Keyed by email so each row reports its own state, not a shared one.
  const [sent, setSent] = useState<Record<string, string>>({});
  const [sending, startSend] = useTransition();

  function reset(email: string) {
    startSend(async () => {
      const r = await sendPasswordReset(email, clientId);
      setSent((s) => ({ ...s, [email]: r.ok ? "Sent" : r.error }));
      if (r.ok) setTimeout(() => setSent((s) => ({ ...s, [email]: "" })), 4000);
    });
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy mb-1">Portal access</h2>
      <p className="text-sm text-muted mb-4">
        Who can log in and see this client&apos;s leads. They get an email and set
        their own password — you never handle it.
      </p>

      {users.length > 0 && (
        <div className="mb-5 grid gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line last:border-0 py-2"
            >
              <div>
                <div className="text-sm font-medium text-navy">{user.email}</div>
                <div className="text-xs text-muted">{user.role.replace("_", " ")}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {sent[user.email] && (
                  <span
                    className={`text-xs font-semibold animate-fade-in ${
                      sent[user.email] === "Sent" ? "text-ok" : "text-danger"
                    }`}
                  >
                    {sent[user.email]}
                  </span>
                )}
                <button
                  disabled={sending}
                  onClick={() => reset(user.email)}
                  className="btn btn-ghost btn-sm"
                >
                  {sending ? "Sending…" : "Resend link"}
                </button>
                <button
                  disabled={removing}
                  onClick={() => startRemove(() => removePortalUser(user.id, clientId))}
                  className="text-xs text-muted hover:text-danger transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {result?.ok && (
        <p className="mb-4 text-sm text-ok font-semibold animate-fade-in">
          {result.existing
            ? `${result.email} already had a login — sent them a fresh link.`
            : `Setup link sent to ${result.email}. They'll set their own password.`}
        </p>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="portal-email">
            Invite by email
          </label>
          <input
            id="portal-email"
            name="email"
            type="email"
            required
            className="field"
            placeholder="owner@theirbusiness.com.au"
          />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Sending…" : "Send setup link"}
        </button>
      </form>

      {result && !result.ok && (
        <p className="mt-3 text-sm text-danger">{result.error}</p>
      )}
    </div>
  );
}
