import { Suspense } from "react";

import { EmailLookSettings } from "@/components/dashboard/email-look-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { findEmailLook } from "@/lib/stores/queries";

// Email design (D-124) on its own page (D-129).
export default function EmailDesignPage() {
  return (
    <>
      <PageHeader title="Email design" description="One look for every email you send. Pick a design and see it right away." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <EmailDesignContent />
      </Suspense>
    </>
  );
}

async function EmailDesignContent() {
  const { user, store } = await requireUnlockedCreator("/dashboard/marketing/emails");
  const emailLook = await findEmailLook(user.id).catch(() => null);
  return <EmailLookSettings initial={emailLook} accent={store.theme.accent} storeName={store.name} />;
}
