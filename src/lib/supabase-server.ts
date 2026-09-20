import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-backed Supabase client for the CLIENT portal.
 *
 * Unlike supabase-admin.ts this uses the anon key, so every query runs through
 * Row Level Security and a logged-in client can only ever reach their own
 * rows. Nothing in /portal should use the service-role client — that would
 * bypass the fencing entirely.
 */
export async function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in."
    );
  }

  const store = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. Session refresh still happens
          // in proxy.ts and in server actions, so this is safe to swallow.
        }
      },
    },
  });
}

/**
 * The logged-in user plus the client they belong to.
 *
 * Returns null when there's no session, or when the user authenticated but has
 * no `portal_users` row — that second case is a real state: someone can hold a
 * valid Supabase session without having been granted portal access yet.
 */
export async function currentPortalUser() {
  const db = await supabaseServer();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return null;

  const { data: portalUser } = await db
    .from("portal_users")
    .select("id, client_id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!portalUser) return { user, portalUser: null, client: null };

  const { data: client } = await db
    .from("clients")
    .select("*")
    .eq("id", portalUser.client_id)
    .maybeSingle();

  return { user, portalUser, client };
}
