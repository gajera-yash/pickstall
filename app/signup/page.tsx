import type { Metadata } from "next";
import { Suspense } from "react";

import { SignupFlow } from "@/components/auth/signup-flow";
import { SignupSource } from "@/components/marketing/signup-source";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";
import { normalizeSlugInput } from "@/lib/slug";

export const metadata: Metadata = { title: `Create your account | ${APP_NAME}` };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  const googleNext = publicEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" ? DASHBOARD_PATH : null;
  // The static shell shows the empty form; a `?username=` from the landing page streams in prefilled.
  return (
    <>
      <SignupSource />
      <Suspense fallback={<SignupFlow googleNext={googleNext} />}>
        <PrefilledSignup searchParams={searchParams} googleNext={googleNext} />
      </Suspense>
    </>
  );
}

async function PrefilledSignup({ searchParams, googleNext }: Pick<PageProps<"/signup">, "searchParams"> & { googleNext: string | null }) {
  const { username } = await searchParams;
  const initialUsername = typeof username === "string" ? normalizeSlugInput(username) : "";
  return <SignupFlow googleNext={googleNext} initialUsername={initialUsername} />;
}
