"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export default function PortalLoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    sendMagicLink,
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
          <p className="text-muted mt-2">Your leads, in one place.</p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center animate-pop">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-tint text-3xl">
                ✉️
              </div>
              <h1 className="text-2xl mb-2">Check your email</h1>
              <p className="text-body">
                We&apos;ve sent a login link to{" "}
                <strong className="text-navy">{state.email}</strong>.
              </p>
              <p className="text-sm text-muted mt-4">
                Click the link and you&apos;re straight in — no password needed.
                It expires in an hour.
              </p>
            </div>
          ) : (
            <form action={formAction}>
              <h1 className="text-2xl mb-2">Log in</h1>
              <p className="text-body mb-6">
                Enter your email and we&apos;ll send you a link. No password to
                remember.
              </p>

              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                className="field"
                placeholder="you@yourbusiness.com.au"
              />

              {state && "error" in state && (
                <p className="mt-3 text-sm text-danger animate-fade-in">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary btn-lg w-full mt-6"
              >
                {pending ? "Sending…" : "Send me a link"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted mt-6">
          Trouble getting in? Contact Revena Media and we&apos;ll sort it.
        </p>
      </div>
    </div>
  );
}
