import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely, so it is the only
 * thing that may write delivery status, assign leads to packs, or resolve
 * replacement requests.
 *
 * SERVER-SIDE ONLY. Importing this into a Client Component would ship the
 * service-role key to the browser and hand every visitor full database
 * access — the guard below is what stops that going unnoticed.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "supabase-admin.ts was imported in the browser. It holds the service-role key and must stay server-side."
  );
}

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
