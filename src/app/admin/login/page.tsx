"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/admin";
  const unconfigured = params.get("error") === "unconfigured";

  const [error, formAction, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel px-6">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
          <p className="text-sm text-muted mt-1">Admin access</p>
        </div>

        {unconfigured && (
          <p className="mb-4 text-sm rounded-xl bg-warn-tint text-warn px-4 py-3">
            No admin password is configured yet. Set <code>ADMIN_PASSWORD</code> in{" "}
            <code>.env.local</code>, then restart the dev server.
          </p>
        )}

        <form action={formAction}>
          <input type="hidden" name="from" value={from} />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
            className="field"
            placeholder="••••••••"
          />

          {error && (
            <p className="mt-3 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary w-full mt-5"
          >
            {pending ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
