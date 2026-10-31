import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { CreatePasswordForm } from "@/components/auth/password-form";
import { Button } from "@/components/ui/button";
import { lookupAccessToken } from "@/lib/auth/access-tokens";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Create your password | ${APP_NAME}`, robots: { index: false }, referrer: "no-referrer" };

// The unique link from the order email (D-037). It proves the buyer owns the email they paid with, so
// they may create a password for it. Nothing about the order is shown until the link is checked.
export default function WelcomePage({ params }: PageProps<"/welcome/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<LoginFormSkeleton label="Checking your link" fields={2} />}>
        <WelcomeContent params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function WelcomeContent({ params }: Pick<PageProps<"/welcome/[token]">, "params">) {
  const { token } = await params;
  const state = await lookupAccessToken(token);

  if (state.status !== "valid") {
    const used = state.status === "used";
    return (
      <>
        <AuthHeading>{used ? "You're all set" : "This link isn't valid"}</AuthHeading>
        <p className="text-center text-mute">
          {used ? "You already created your password. Sign in to open your purchases." : "The link expired or was copied wrongly. Sign in with an email code to reach your purchases."}
        </p>
        <Button asChild size="lg">
          <Link href="/login?next=%2Flibrary">Sign in</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 text-center">
        <AuthHeading>Welcome, {state.token.name.split(/\s+/)[0]}</AuthHeading>
        <p className="text-mute">Your payment is confirmed. Create a password to see and open everything you bought.</p>
      </div>
      <CreatePasswordForm token={token} email={state.token.email} />
    </>
  );
}
