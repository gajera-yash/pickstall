import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/config";
import { findByUnsubscribeToken } from "@/lib/subscribers/unsubscribe";

export const metadata: Metadata = { title: `Unsubscribe | ${APP_NAME}`, robots: { index: false, follow: false } };

// The footer link of list emails (D-095). Opening the link changes nothing (mail scanners open
// links); the button below unsubscribes. Shows only the store name, never the email address.
export default function UnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
        <UnsubscribeContent params={params} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function UnsubscribeContent({ params, searchParams }: Pick<PageProps<"/u/[token]">, "params" | "searchParams">) {
  await connection();
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const found = await findByUnsubscribeToken(token).catch(() => null);

  if (!found) {
    return (
      <>
        <AuthHeading>Link not found</AuthHeading>
        <p className="text-center text-mute">This unsubscribe link doesn&apos;t work any more. Use the link in a newer email, or reply to the email and ask the sender.</p>
      </>
    );
  }

  if (!found.subscribed || query.done === "1") {
    return (
      <>
        <AuthHeading>You&apos;re unsubscribed</AuthHeading>
        <p className="text-center text-mute">You won&apos;t get more emails from {found.storeName}. Emails about things you bought still arrive.</p>
      </>
    );
  }

  return (
    <>
      <AuthHeading>Unsubscribe from {found.storeName}?</AuthHeading>
      <p className="text-center text-mute">You&apos;ll stop getting updates and offers from {found.storeName}. Emails about things you bought still arrive.</p>
      <form method="post" action={`/api/unsubscribe/${token}`} className="flex flex-col">
        <input type="hidden" name="from" value="page" />
        <Button type="submit" size="lg">
          Unsubscribe
        </Button>
      </form>
    </>
  );
}
