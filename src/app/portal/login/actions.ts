"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export type LoginState = { sent: true; email: string } | { error: string } | null;

/**
 * Sends a magic link. No passwords anywhere in the client portal — trades
 * clients lose passwords and you'd be the one fielding the resets.
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: "Enter your email address." };
  }

  // The login page renders fine before Supabase is set up, so the form can be
  // submitted before there's anywhere to send the request. Say so plainly.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return {
      error: "This portal isn't connected to its database yet. Contact Revena Media.",
    };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const db = await supabaseServer();

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${proto}://${host}/portal/auth/callback`,
      // Critical: without this, anyone who enters any email gets an account.
      // Portal access is granted by you inviting them, never self-serve.
      shouldCreateUser: false,
    },
  });

  if (error) {
    // Deliberately not surfacing "user not found" — that would let anyone probe
    // which businesses you work with. The success screen is shown either way.
    if (/not found|signups not allowed|invalid/i.test(error.message)) {
      return { sent: true, email };
    }
    return { error: error.message };
  }

  return { sent: true, email };
}

export async function portalLogout() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/portal/login");
}
