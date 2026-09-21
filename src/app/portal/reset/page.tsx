"use client";

import { useActionState } from "react";
import { updatePassword, type LoginState } from "../login/actions";

/**
 * Where a reset or invite link lands. The callback route has already exchanged
 * the code for a session by this point, so the user is signed in and simply
 * needs to choose a password.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    updatePassword,
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
        </div>

        <div className="card p-8">
          <form action={formAction}>
            <h1 className="text-2xl mb-2">Choose a password</h1>
            <p className="text-body mb-6">
              Pick something you&apos;ll remember — your browser can save it for you.
            </p>

            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              minLength={8}
              className="field"
              placeholder="At least 8 characters"
            />

            <label className="label mt-4" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="field"
              placeholder="Type it again"
            />

            {state && "error" in state && (
              <p className="mt-4 text-sm text-danger animate-fade-in">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary btn-lg w-full mt-6"
            >
              {pending ? "Saving…" : "Save password and log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
