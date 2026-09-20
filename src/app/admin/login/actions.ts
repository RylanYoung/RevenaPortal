"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken } from "@/lib/admin-auth";

export async function login(_prev: string | null, formData: FormData) {
  const submitted = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/admin");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return "ADMIN_PASSWORD isn't set. Add it to .env.local (and to Vercel) and restart.";
  }
  if (submitted !== expected) {
    return "Wrong password.";
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, await adminToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Only allow same-app paths back — an open redirect here would let a
  // crafted login link bounce you to another site after authenticating.
  redirect(from.startsWith("/admin") ? from : "/admin");
}

export async function logout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
