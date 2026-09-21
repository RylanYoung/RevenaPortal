"use client";

import { useActionState, useState, useTransition } from "react";
import {
  invitePortalUser,
  removePortalUser,
  sendPasswordReset,
} from "@/app/admin/actions";
import { CopyField } from "./copy-field";

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
  const [showCustom, setShowCustom] = useState(false);

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
        Who can log in and see this client&apos;s leads. They sign in with their
        email and a password.
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
                  {sending ? "Sending…" : "Email password reset"}
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

      {/* ---- the password, shown once, right after it's created ---- */}
      {result?.ok && (
        <div className="mb-5 rounded-xl bg-ok-tint border border-line p-5 animate-fade-up">
          <div className="text-sm font-semibold text-navy mb-1">
            {result.existing ? "Password reset" : "Login created"} — send these to
            them
          </div>
          <p className="text-xs text-muted mb-3">
            This is the only time the password is shown. If you lose it, set a new
            one — you can&apos;t look it up.
          </p>
          <CopyField
            multiline
            value={`Portal: ${typeof window !== "undefined" ? window.location.origin : ""}/portal/login\nEmail: ${result.email}\nPassword: ${result.password}`}
          />
        </div>
      )}

      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label" htmlFor="portal-email">
              Create a login
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
            {pending ? "Creating…" : "Create login"}
          </button>
        </div>

        {showCustom ? (
          <div>
            <label className="label" htmlFor="portal-password">
              Password
            </label>
            <input
              id="portal-password"
              name="password"
              type="text"
              minLength={8}
              className="field"
              placeholder="At least 8 characters"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-xs text-muted hover:text-navy text-left w-fit"
          >
            Set the password myself (otherwise one is generated)
          </button>
        )}
      </form>

      {result && !result.ok && (
        <p className="mt-3 text-sm text-danger">{result.error}</p>
      )}
    </div>
  );
}
