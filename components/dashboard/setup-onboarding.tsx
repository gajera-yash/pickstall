import { ArrowRight, Check, ChevronRight, CreditCard, Package, Rocket, Settings, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SETUP_PATH, type Checklist, type ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

// Copy and icons from the founder's reference screen (D-079).
const STEPS: Record<ChecklistItemId, { title: string; text: string; icon: LucideIcon }> = {
  "store-setup": { title: "Store Details", text: "Add your store name, logo and basic info.", icon: Store },
  "first-product": { title: "Add Products", text: "List your first product to start selling.", icon: Package },
  "connect-payments": { title: "Set Payments", text: "Connect a payment method to receive orders.", icon: CreditCard },
  publish: { title: "Go Live", text: "Publish your store and start selling.", icon: Rocket },
};

/**
 * My Store while setup is incomplete (D-079): an illustration, "Set up your store to get started",
 * the four setup steps with real progress, and the button into the setup wizard. Replaces the full
 * My Store page until the dashboard unlocks.
 */
export function SetupOnboarding({ checklist }: { checklist: Checklist }) {
  const started = checklist.doneCount > 0;
  return (
    <section aria-labelledby="onboarding-title" className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 py-4 text-center sm:py-8">
      <StoreIllustration />

      <div className="flex max-w-2xl flex-col gap-3">
        <h1 id="onboarding-title" className="font-display text-display text-ink">
          Set up your store <span className="text-blue">to get started</span>
        </h1>
        <p className="text-body-l text-mute">
          Your store isn&apos;t set up yet. Complete a few quick steps to start selling, manage products, track orders, and grow your business.
        </p>
        <p className="text-sm font-semibold text-ink">
          {checklist.doneCount} of {checklist.requiredCount} steps done
        </p>
      </div>

      <ol className="grid w-full max-w-sm gap-3 text-left sm:max-w-none sm:grid-cols-4 sm:gap-6 sm:text-center">
        {checklist.items.map((item, index) => {
          const step = STEPS[item.id];
          const Icon = step.icon;
          const current = checklist.next?.id === item.id;
          const last = index === checklist.items.length - 1;
          const status = item.done ? "done" : !item.available ? "not needed yet" : current ? "next step" : "to do";
          return (
            <li
              key={item.id}
              aria-current={current ? "step" : undefined}
              className={cn(
                "relative flex items-center gap-4 rounded-lg border p-3 sm:flex-col sm:gap-3 sm:border-0 sm:p-0",
                current ? "border-blue bg-blue-soft sm:bg-transparent" : "border-line bg-surface sm:bg-transparent",
              )}
            >
              <span className="relative shrink-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-14 items-center justify-center rounded-lg border shadow-sm sm:size-18",
                    current ? "border-blue/30 bg-blue-soft text-blue" : "border-line bg-surface text-ink",
                  )}
                >
                  <Icon className="size-6 sm:size-7" strokeWidth={1.75} />
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-surface text-xs font-extrabold",
                    item.done ? "bg-mint text-surface" : current ? "bg-blue text-on-blue" : "bg-mute text-surface",
                  )}
                >
                  {item.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-h3 text-ink">
                  {step.title}
                  <span className="sr-only">, step {index + 1}, {status}</span>
                </span>
                <span className="text-sm text-mute">{item.available ? step.text : "Not needed on this server yet. You can skip it."}</span>
                {item.done && <span className="text-xs font-semibold text-mint">Done</span>}
              </span>
              {!last && (
                <ChevronRight aria-hidden="true" className="absolute top-6 -right-6 hidden size-6 -translate-x-0 text-mute sm:block" />
              )}
            </li>
          );
        })}
      </ol>

      <Button asChild size="lg" className="w-full max-w-sm px-8 sm:w-auto">
        <Link href={SETUP_PATH}>
          <Store aria-hidden="true" />
          {started ? "Continue setting up" : "Set Up My Store"}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}

/** Storefront with a striped awning, a check badge, a bag tile and a gear tile. Decoration only. */
function StoreIllustration() {
  return (
    <div aria-hidden="true" className="relative h-44 w-72 sm:h-56 sm:w-[30rem]">
      {/* Dashed orbit behind the store. */}
      <span className="absolute inset-x-0 top-1/2 h-28 -translate-y-1/3 rounded-[50%] border-2 border-dashed border-blue/25 sm:h-36" />

      {/* Store. */}
      <div className="absolute top-2 left-1/2 flex h-40 w-40 -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-md sm:h-52 sm:w-56">
        <div className="flex h-6 items-center gap-1 bg-blue/70 px-3 sm:h-8">
          <span className="size-1.5 rounded-full bg-surface" />
          <span className="size-1.5 rounded-full bg-surface" />
          <span className="size-1.5 rounded-full bg-surface" />
        </div>
        <div className="flex px-2">
          {[0, 1, 2, 3].map((stripe) => (
            <span key={stripe} className={cn("h-9 flex-1 rounded-b-full sm:h-12", stripe % 2 === 0 ? "bg-blue" : "bg-blue-soft")} />
          ))}
        </div>
        <div className="flex flex-1 items-end gap-2 px-4 pt-3">
          <span className="h-full flex-1 rounded-t-sm bg-blue-soft" />
          <span className="h-full w-1/3 rounded-t-sm bg-blue/30" />
        </div>
        <span className="absolute bottom-6 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-md bg-surface shadow-md sm:size-12">
          <span className="flex size-6 items-center justify-center rounded-full bg-mint text-surface sm:size-7">
            <Check className="size-4" strokeWidth={3} />
          </span>
        </span>
      </div>

      {/* Side tiles. */}
      <span className="absolute top-8 left-0 flex size-14 items-center justify-center rounded-lg border border-line bg-surface text-blue shadow-md sm:top-10 sm:left-6 sm:size-18">
        <ShoppingBag className="size-7 sm:size-8" strokeWidth={1.75} />
      </span>
      <span className="absolute top-12 right-0 flex size-14 items-center justify-center rounded-lg border border-line bg-surface text-blue shadow-md sm:top-14 sm:right-6 sm:size-18">
        <Settings className="size-7 sm:size-8" strokeWidth={1.75} />
      </span>

      {/* Sparkle lines. */}
      <span className="absolute top-0 left-[30%] h-4 w-1 -rotate-30 rounded-full bg-yellow sm:left-[32%]" />
      <span className="absolute top-3 left-[25%] h-1 w-4 -rotate-12 rounded-full bg-yellow sm:left-[28%]" />
    </div>
  );
}
