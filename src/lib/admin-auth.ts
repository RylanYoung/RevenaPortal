/**
 * Admin gate. A single shared password for Rylan — deliberately NOT Supabase
 * Auth, which is reserved for client logins so the two never get confused.
 *
 * Uses Web Crypto rather than `node:crypto` because this runs inside proxy.ts,
 * which may execute on the edge runtime where node builtins are unavailable.
 */

export const ADMIN_COOKIE = "revena_admin";

/**
 * The cookie stores a hash of the password, never the password itself, so a
 * leaked cookie jar doesn't hand over the credential in plain text.
 */
export async function adminToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`revena-admin:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare, so a wrong cookie can't be brute-forced by timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
