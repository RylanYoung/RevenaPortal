"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export type LoginState = { error: string } | null;
export type ResetState = { sent: true; email: string } | { error: string } | null;

/**
 * Email + password sign-in.
 *
 * Deliberately not magic links: those email on every single login, which runs
 * into Supabase's per-address rate limit and leaves a client staring at a
 * "try again in 24 seconds" message with no way forward. A password they can
 * save in their browser has none of that.
 */
export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) return { error: "Enter your email and password." };

  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    // Never distinguish "no such account" from "wrong password" — that would
    // let anyone check which businesses have portal access.
    return { error: "That email and password don't match. Try again." };
  }

  if (!remember) {
    // Downgrade Supabase's auth cookies to session cookies so they die with
    // the browser. Ticking the box leaves them persistent, which is the default.
    const store = await cookies();
    for (const c of store.getAll()) {
      if (c.name.startsWith("sb-")) {
        store.set(c.name, c.value, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
      }
    }
  }

  redirect("/portal");
}

/** Sends a password-reset email. */
export async function requestReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter your email address." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const db = await supabaseServer();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/portal/auth/callback?next=/portal/reset`,
  });

  // Same screen either way — whether an address has an account isn't something
  // a stranger should be able to probe.
  if (error && !/not found|invalid/i.test(error.message)) {
    return { error: error.message };
  }
  return { sent: true, email };
}

/** Sets a new password for whoever is currently signed in. */
export async function updatePassword(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Those two passwords don't match." };

  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "That reset link has expired. Request a new one." };

  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/portal");
}

export async function portalLogout() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect("/portal/login");
}
