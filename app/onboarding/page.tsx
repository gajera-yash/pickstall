import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { WizardProgress } from "@/components/auth/wizard-progress";
import { Wordmark } from "@/components/brand/wordmark";
import { StoreBasicsForm } from "@/components/onboarding/store-basics-form";
import { requireUser } from "@/lib/auth/guards";
import { DASHBOARD_PATH, ONBOARDING_PATH } from "@/lib/auth/post-login";
import { APP_NAME } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Set up your store | ${APP_NAME}`, robots: { index: false } };

export default function OnboardingPage() {
  return (
    <AuthShell top={<WizardProgress step="store" />}>
      <AuthHeading wordmark={<Wordmark />}>Set up your store</AuthHeading>
      {/* Reads the signed-in user, which is request data, so it renders behind a boundary. */}
      <Suspense fallback={<LoginFormSkeleton label="Loading your store setup" fields={3} />}>
        <OnboardingContent />
      </Suspense>
    </AuthShell>
  );
}

async function OnboardingContent() {
  const user = await requireUser(ONBOARDING_PATH);

  // Already has a store (finished before, or a second tab): nothing to set up.
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing) redirect(DASHBOARD_PATH);

  return (
    <>
      <p className="-mt-3 text-center text-mute">Almost there. Tell us a little about your store.</p>
      <StoreBasicsForm defaults={{ name: user.prefill.fullName ?? "", username: user.prefill.username ?? null }} />
    </>
  );
}
