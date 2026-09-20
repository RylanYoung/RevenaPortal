/**
 * Shown when the app is running but Supabase isn't configured. Reached by a
 * redirect from proxy.ts, so it catches every /admin and /portal route at once
 * rather than each page throwing its own stack trace.
 */
export default function SetupRequiredPage() {
  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_ANON_KEY && "SUPABASE_ANON_KEY",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !process.env.ADMIN_PASSWORD && "ADMIN_PASSWORD",
    !process.env.GHL_WEBHOOK_SECRET && "GHL_WEBHOOK_SECRET",
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel px-6 py-12">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
        </div>

        <div className="card p-8">
          <h1 className="text-2xl mb-2">Nearly there</h1>
          <p className="text-body mb-6">
            The app is running, but it isn&apos;t connected to a database yet.
            Once these are set, everything works.
          </p>

          <div className="rounded-xl bg-panel border border-line p-5 mb-6">
            <div className="text-sm font-semibold text-navy mb-3">
              Still needed in <code>.env.local</code>
            </div>
            {missing.length === 0 ? (
              <p className="text-sm text-ok font-semibold">
                All set — restart the dev server to pick them up.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {missing.map((key) => (
                  <li key={key} className="text-sm font-mono text-danger">
                    {key}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ol className="text-sm text-body space-y-3 list-decimal pl-5">
            <li>
              Create a <strong>new</strong> Supabase project — not the one
              revena-dashboard uses, or their <code>clients</code> tables collide.
            </li>
            <li>
              Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.
            </li>
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code> and paste
              your keys in from Project Settings → API.
            </li>
            <li>Restart the dev server.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
