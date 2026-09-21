import { redirect } from "next/navigation";
import { currentPortalUser } from "@/lib/supabase-server";
import { OnboardingForm } from "@/components/onboarding-form";
import type { Answers } from "@/lib/onboarding";
import { portalLogout } from "../login/actions";

export const dynamic = "force-dynamic";

/**
 * The first thing a client sees. Outside the (shell) layout on purpose —
 * showing them a nav they can't use yet just invites them to try.
 */
export default async function WelcomePage() {
  const session = await currentPortalUser();
  if (!session) redirect("/portal/login");
  if (!session.client) redirect("/portal");

  // Already done — nothing to come back for.
  if (session.client.onboarding_completed_at) redirect("/portal");

  // Pre-fill anything already on their record so they're confirming, not
  // retyping what you already gave us.
  const initial: Answers = {
    business_name: session.client.business_name ?? "",
    contact_name: session.client.contact_name ?? "",
    phone: session.client.phone ?? "",
    email: session.client.email ?? session.portalUser?.email ?? "",
    ...(session.client.service_type && session.client.service_type !== "both"
      ? { leads_purchased: session.client.service_type }
      : {}),
  };

  return (
    <div className="min-h-screen bg-panel">
      <header className="bg-bg border-b border-line">
        <div className="mx-auto max-w-[760px] px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-navy tracking-tight">
            Revena<span className="text-blue">.</span>
          </div>
          <form action={portalLogout}>
            <button className="text-sm text-muted hover:text-navy transition-colors">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-10 lg:py-14">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl sm:text-4xl">Welcome aboard.</h1>
          <p className="text-lg text-muted mt-2">
            A few quick details so we send you the right leads, the right way.
            Takes about two minutes and you won&apos;t be asked again.
          </p>
        </div>

        <OnboardingForm initial={initial} />
      </main>
    </div>
  );
}
