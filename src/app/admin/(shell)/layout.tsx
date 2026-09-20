import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminNav } from "@/components/admin-nav";
import { logout } from "../login/actions";

/**
 * The admin shell. Lives in a `(shell)` route group so /admin/login can sit
 * outside it and render without the sidebar.
 */

// Queue counts must never be served stale — a cached "0 waiting" would hide
// real work from you.
export const dynamic = "force-dynamic";

async function queueCounts() {
  try {
    const db = supabaseAdmin();
    const [unassigned, requests] = await Promise.all([
      db.from("leads").select("id", { count: "exact", head: true }).is("client_id", null),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "replacement_requested"),
    ]);
    return {
      unassigned: unassigned.count ?? 0,
      requests: requests.count ?? 0,
    };
  } catch {
    // Supabase not configured yet — the pages themselves explain how to fix it.
    return { unassigned: 0, requests: 0 };
  }
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const counts = await queueCounts();

  return (
    <div className="flex min-h-screen bg-panel">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-line bg-bg p-5">
        <Link href="/admin" className="mb-8 block">
          <div className="text-xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
          <div className="text-xs text-muted">Lead portal admin</div>
        </Link>

        <AdminNav counts={counts} />

        <form action={logout} className="mt-auto pt-6">
          <button
            type="submit"
            className="w-full text-left text-sm text-muted hover:text-navy transition-colors"
          >
            Log out
          </button>
        </form>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile nav — the sidebar is hidden below md. */}
        <div className="md:hidden border-b border-line bg-bg px-5 py-3">
          <Link href="/admin" className="text-lg font-bold text-navy">
            Revena<span className="text-blue">.</span>
          </Link>
          <div className="mt-3 overflow-x-auto">
            <AdminNav counts={counts} />
          </div>
        </div>

        <main className="p-6 lg:p-10 max-w-[1180px]">{children}</main>
      </div>
    </div>
  );
}
