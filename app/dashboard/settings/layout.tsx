import { Suspense } from "react";

import { SettingsNav } from "@/components/dashboard/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { loadSetupGate } from "@/lib/dashboard/setup-gate";

// Settings (PRD F8, DESIGN.md 10.2): sub-nav Store, Payments, Plan, Account next to the page content.
export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <h1 className="font-display text-h1">Settings</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-20 lg:w-48 lg:shrink-0">
          {/* The setup lock (D-079) is request data, so the nav streams in behind a boundary. */}
          <Suspense fallback={<Skeleton className="h-11 w-full rounded-md lg:h-44" />}>
            <SettingsNavWithData />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}

async function SettingsNavWithData() {
  const { store } = await requireCreator("/dashboard/settings");
  const { unlocked } = await loadSetupGate(store);
  return <SettingsNav unlocked={unlocked} />;
}
