"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, type ResetState } from "../login/actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    requestReset,
    null
  );

  const sent = state && "sent" in state;

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center animate-pop">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-tint text-3xl">
                ✉️
              </div>
              <h1 className="text-2xl mb-2">Check your email</h1>
              <p className="text-body">
                If <strong className="text-navy">{state.email}</strong> has an account,
                a reset link is on its way.
              </p>
              <Link href="/portal/login" className="btn btn-ghost mt-6">
                Back to login
              </Link>
            </div>
          ) : (
            <form action={formAction}>
              <h1 className="text-2xl mb-2">Reset your password</h1>
              <p className="text-body mb-6">
                Enter your email and we&apos;ll send you a link to set a new one.
              </p>

              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                className="field"
                placeholder="you@yourbusiness.com.au"
              />

              {state && "error" in state && (
                <p className="mt-3 text-sm text-danger animate-fade-in">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary btn-lg w-full mt-6"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>

              <Link
                href="/portal/login"
                className="block text-center text-sm text-muted hover:text-navy mt-5"
              >
                Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
