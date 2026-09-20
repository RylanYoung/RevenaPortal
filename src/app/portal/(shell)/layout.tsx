import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPortalUser } from "@/lib/supabase-server";
import { PortalNav } from "@/components/portal-nav";
import { portalLogout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await currentPortalUser();

  if (!session) redirect("/portal/login");

  // A valid Supabase session with no portal_users row is a real state — the
  // account exists but hasn't been linked to a client yet. Say so plainly
  // rather than showing an empty dashboard that looks broken.
  if (!session.portalUser || !session.client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-panel px-6">
        <div className="card p-8 max-w-md text-center animate-fade-up">
          <h1 className="text-2xl mb-3">Almost there</h1>
          <p className="text-body">
            Your login works, but this account isn&apos;t linked to a business yet.
            Contact Revena Media and we&apos;ll finish setting you up.
          </p>
          <form action={portalLogout} className="mt-6">
            <button className="btn btn-ghost">Log out</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-panel">
      <header className="bg-bg border-b border-line sticky top-0 z-10">
        <div className="mx-auto max-w-[1180px] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/portal" className="shrink-0">
              <div className="text-xl font-bold text-navy tracking-tight leading-none">
                Revena<span className="text-blue">.</span>
              </div>
            </Link>
            <div className="hidden sm:block">
              <PortalNav />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:block text-sm text-muted">
              {session.client.business_name}
            </span>
            <form action={portalLogout}>
              <button className="text-sm text-muted hover:text-navy transition-colors">
                Log out
              </button>
            </form>
          </div>
        </div>

        {/* Nav drops below the logo on narrow screens rather than squeezing. */}
        <div className="sm:hidden px-6 pb-3">
          <PortalNav />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-8 lg:py-12">{children}</main>
    </div>
  );
}
