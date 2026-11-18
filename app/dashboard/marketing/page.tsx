import { Mail, Percent, ShoppingCart, type LucideIcon } from "lucide-react";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";

const TOOLS: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Coupons", description: "Percent or fixed discounts with an expiry date and a usage limit.", icon: Percent },
  { title: "Order bumps", description: "Offer one more product at checkout with a single tick.", icon: ShoppingCart },
  { title: "Email list", description: "Collect emails on your store and send updates to your buyers.", icon: Mail },
];

// Marketing (D-029). The tools are Phase 2 (PRD section 9), so each card says so honestly.
export default function MarketingPage() {
  return (
    <>
      <PageHeader title="Marketing" description="Tools to sell more to the audience you already have." />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
        <MarketingContent />
      </Suspense>
    </>
  );
}

async function MarketingContent() {
  await requireUnlockedCreator("/dashboard/marketing");
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {TOOLS.map(({ title, description, icon: Icon }) => (
        <li key={title}>
          <Card className="h-full gap-3">
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-blue-soft text-blue">
                <Icon className="size-5" />
              </span>
              <Badge variant="soon">Coming soon</Badge>
            </div>
            <h2 className="font-display text-h3">{title}</h2>
            <p className="text-sm text-mute">{description}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
