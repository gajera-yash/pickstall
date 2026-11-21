import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountData } from "@/components/account/account-data";
import { RecentActivity } from "@/components/account/recent-activity";
import { BuyerHeader } from "@/components/library/buyer-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { APP_NAME } from "@/lib/config";
import { findStoreByOwner } from "@/lib/stores/queries";

export const metadata: Metadata = { title: `Your account | ${APP_NAME}`, robots: { index: false } };

// Account page for everyone, buyers included (D-074): download your data or delete your account.
// Creators also have this in Settings > Account.
export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-subtle">
      <BuyerHeader />
      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <AccountContent />
        </Suspense>
      </main>
    </div>
  );
}

async function AccountContent() {
  const user = await requireUser("/account");
  const store = await findStoreByOwner(user.id);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">Your account</h1>
        <p className="text-sm text-mute">
          Signed in as <strong className="text-ink">{user.email}</strong>.{" "}
          <Link href={store ? "/dashboard" : "/library"} className="font-semibold text-blue underline underline-offset-4">
            {store ? "Back to dashboard" : "Back to my library"}
          </Link>
        </p>
      </div>
      <RecentActivity userId={user.id} />
      <AccountData hasStore={store !== null} />
    </>
  );
}
