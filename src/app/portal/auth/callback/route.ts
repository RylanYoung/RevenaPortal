import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Where the magic link lands. Swaps the one-time code for a session cookie,
 * then sends them into the portal.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Supabase reports link problems (expired, already used) here.
  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set("error", authError);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/portal/login", origin));
  }

  const db = await supabaseServer();
  const { error } = await db.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set("error", "That link has expired. Request a new one.");
    return NextResponse.redirect(url);
  }

  // Reset and invite links carry ?next=/portal/reset so the user lands on the
  // choose-a-password screen. Only same-app paths are honoured — an absolute
  // URL here would be an open redirect off the back of a valid login.
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/portal") ? next : "/portal";

  return NextResponse.redirect(new URL(dest, origin));
}
