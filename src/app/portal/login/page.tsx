"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

export default function PortalLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null
  );
  // A dead setup link redirects here with ?error=... — without showing it, the
  // user just sees a login form and has no idea why their link didn't work.
  const linkError = useSearchParams().get("error");

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
          {linkError && (
            <p className="mb-5 rounded-xl bg-warn-tint text-warn px-4 py-3 text-sm animate-fade-in">
              {linkError}
            </p>
          )}
          <form action={formAction}>
            <h1 className="text-2xl mb-6">Log in</h1>

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

            <label className="label mt-4" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              // Tells the browser and password managers to offer to save it.
              autoComplete="current-password"
              required
              className="field"
              placeholder="••••••••"
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-body cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="remember"
                  defaultChecked
                  className="h-4 w-4 accent-[var(--color-blue)]"
                />
                Keep me logged in
              </label>
              <Link
                href="/portal/forgot"
                className="text-sm text-blue font-semibold hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {state && "error" in state && (
              <p className="mt-4 text-sm text-danger animate-fade-in">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary btn-lg w-full mt-6"
            >
              {pending ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          No login yet? Contact Revena Media and we&apos;ll set you up.
        </p>
      </div>
    </div>
  );
}
