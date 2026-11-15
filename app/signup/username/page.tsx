import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { UsernameStep } from "@/components/auth/username-step";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/guards";
import { DASHBOARD_PATH, USERNAME_PATH } from "@/lib/auth/post-login";
import { getProfile } from "@/lib/auth/profiles";
import { APP_NAME } from "@/lib/config";
import { NEW_STORE_MESSAGES, type NewStoreBlock } from "@/lib/stores/new-store-messages";
import { findStoreByOwner } from "@/lib/stores/queries";

export const metadata: Metadata = { title: `Choose your username | ${APP_NAME}`, robots: { index: false } };

// Reference: docs/ui-reference/username.webp (D-026).
export default function UsernamePage({ searchParams }: PageProps<"/signup/username">) {
  return (
    <AuthShell>
      {/* Reads the signed-in user and query params (request data), so it renders behind a boundary. */}
      <Suspense fallback={<LoginFormSkeleton label="Loading" fields={2} />}>
        <UsernameContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function UsernameContent({ searchParams }: Pick<PageProps<"/signup/username">, "searchParams">) {
  const user = await requireUser(USERNAME_PATH);
  const [store, profile] = await Promise.all([findStoreByOwner(user.id), getProfile(user.id)]);
  if (store) redirect(DASHBOARD_PATH);

  const params = await searchParams;
  const taken = params.taken === "1";
  // Only known reasons are shown, each with its own fixed text (D-071).
  const blocked = typeof params.blocked === "string" && Object.hasOwn(NEW_STORE_MESSAGES, params.blocked) ? (params.blocked as NewStoreBlock) : null;
  const initial = (profile?.fullName || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      {user.email && (
        <div className="flex flex-col items-center gap-2 border-b border-line pb-6 text-center">
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full bg-blue-soft font-display text-h2 font-bold text-ink"
          >
            {initial}
          </span>
          <p className="text-sm text-mute">
            Signed in as
            <strong className="block text-base font-semibold break-all text-ink">{user.email}</strong>
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 text-center">
        <AuthHeading>One last step</AuthHeading>
        <p className="text-mute">Choose your username. This becomes your store link.</p>
      </div>
      {blocked && (
        <Alert variant="warning">
          <AlertTitle>We couldn&apos;t open your store</AlertTitle>
          <AlertDescription>{NEW_STORE_MESSAGES[blocked]}</AlertDescription>
        </Alert>
      )}
      <UsernameStep needsName={!profile?.fullName} taken={taken} />
    </>
  );
}
