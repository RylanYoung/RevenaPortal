import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, adminToken, safeEqual } from "@/lib/admin-auth";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`.
 *
 * Two separate gates, deliberately unrelated:
 *  - /admin  → one shared password (Rylan)
 *  - /portal → Supabase Auth session (clients), with RLS doing the real fencing
 *
 * The GHL webhook carries its own secret and is exempt from both.
 */

async function guardAdmin(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  // Fail closed. An unset password must not leave the admin area wide open.
  if (!password) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("error", "unconfigured");
    return NextResponse.redirect(url);
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await adminToken(password);

  if (cookie && safeEqual(cookie, expected)) {
    return NextResponse.next();
  }

  const url = new URL("/admin/login", request.url);
  if (request.nextUrl.pathname !== "/admin") {
    url.searchParams.set("from", request.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

async function guardPortal(request: NextRequest) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;

  // This response carries any refreshed auth cookies back to the browser.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against Supabase rather than trusting the cookie,
  // and is what triggers the token refresh handled by setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The intake endpoint authenticates itself against GHL_WEBHOOK_SECRET.
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // These must stay reachable or there's no way to log in — and they render
  // without a database, which makes them viewable before setup is finished.
  // /portal/forgot is public by necessity: someone locked out has no session.
  // /portal/reset is NOT listed — the callback signs them in first, so it is
  // correctly behind the guard.
  if (
    pathname === "/admin/login" ||
    pathname === "/portal/login" ||
    pathname === "/portal/forgot"
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/portal/auth/")) {
    return NextResponse.next();
  }

  // Catch a missing database config here, once, rather than letting every
  // page throw its own stack trace at whoever opened it.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/setup-required", request.url));
  }

  // /api/admin/* carries the same shared-password gate as the admin pages —
  // it reads through the service-role key, so it must never be public.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return guardAdmin(request);
  }
  if (pathname.startsWith("/portal")) return guardPortal(request);

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/portal/:path*"],
};
