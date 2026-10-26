import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { UsernameStep } from "@/components/auth/username-step";
import { WizardProgress } from "@/components/auth/wizard-progress";
import { Wordmark } from "@/components/brand/wordmark";
import { requireUser } from "@/lib/auth/guards";
import { DASHBOARD_PATH, USERNAME_PATH } from "@/lib/auth/post-login";
import { APP_NAME } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Choose your username | ${APP_NAME}`, robots: { index: false } };

export default function UsernamePage({ searchParams }: PageProps<"/signup/username">) {
  return (
    <AuthShell top={<WizardProgress step="code" />}>
      <AuthHeading wordmark={<Wordmark />}>Choose your username</AuthHeading>
      {/* Reads the signed-in user and query params (request data), so it renders behind a boundary. */}
      <Suspense fallback={<LoginFormSkeleton label="Loading" fields={2} />}>
        <UsernameContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function UsernameContent({ searchParams }: Pick<PageProps<"/signup/username">, "searchParams">) {
  const user = await requireUser(USERNAME_PATH);
  const supabase = await createSupabaseServerClient();

  const [{ data: store }, { data: profile }] = await Promise.all([
    supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
  ]);
  if (store) redirect(DASHBOARD_PATH);

  const params = await searchParams;
  const taken = params.taken === "1";
  return <UsernameStep needsName={!profile?.full_name} taken={taken} />;
}
