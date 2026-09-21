import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Where invite and password-reset links land.
 *
 * Uses `token_hash` + verifyOtp, NOT Supabase's default {{ .ConfirmationURL }}.
 * That default bounces through Supabase's /verify endpoint and hands the
 * session back as a URL *fragment* (#access_token=...). Fragments are never
 * sent to the server, so a server-rendered app sees no session at all and
 * bounces the user to the login page — which is exactly what happened.
 *
 * `code` is still handled for OAuth-style PKCE links, so both shapes work.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set("error", authError);
    return NextResponse.redirect(url);
  }

  const db = await supabaseServer();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let failed = false;

  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else {
    failed = true;
  }

  if (failed) {
    const url = new URL("/portal/login", origin);
    url.searchParams.set(
      "error",
      "That link has expired or was already used. Ask us for a new one."
    );
    return NextResponse.redirect(url);
  }

  // Signed in — now let them choose a password.
  return NextResponse.redirect(new URL("/portal/reset", origin));
}
