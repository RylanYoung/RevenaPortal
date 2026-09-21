import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Where invite and password-reset links land.
 *
 * This exists as its own path rather than `/portal/auth/callback?next=...`
 * because Supabase strips the query string off a redirect target — the link
 * came back pointing at the site root, which would drop a brand new client on
 * a dashboard they have no password for. A path survives that.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set("error", authError);
    return NextResponse.redirect(url);
  }

  if (!code) return NextResponse.redirect(new URL("/portal/login", origin));

  const db = await supabaseServer();
  const { error } = await db.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set("error", "That link has expired. Ask us for a new one.");
    return NextResponse.redirect(url);
  }

  // Signed in — now let them choose a password.
  return NextResponse.redirect(new URL("/portal/reset", origin));
}
