"use client";

import { useActionState, useTransition } from "react";
import { invitePortalUser, removePortalUser } from "@/app/admin/actions";

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

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy mb-1">Portal access</h2>
      <p className="text-sm text-muted mb-4">
        Who can log in and see this client&apos;s leads. They sign in with a magic
        link — no passwords.
      </p>

      {users.length > 0 && (
        <div className="mb-5 grid gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-4 border-b border-line last:border-0 py-2"
            >
              <div>
                <div className="text-sm font-medium text-navy">{user.email}</div>
                <div className="text-xs text-muted">{user.role.replace("_", " ")}</div>
              </div>
              <button
                disabled={removing}
                onClick={() => startRemove(() => removePortalUser(user.id, clientId))}
                className="text-xs text-muted hover:text-danger transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
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
          {pending ? "Inviting…" : "Send invite"}
        </button>
      </form>

      {result?.ok && (
        <p className="mt-3 text-sm text-ok font-semibold animate-fade-in">
          Invite sent. They can also log in any time at /portal/login.
        </p>
      )}
      {result && !result.ok && (
        <p className="mt-3 text-sm text-danger">{result.error}</p>
      )}
    </div>
  );
}
