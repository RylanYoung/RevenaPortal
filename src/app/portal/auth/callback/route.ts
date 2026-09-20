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

  return NextResponse.redirect(new URL("/portal", origin));
}
