import { Check, CreditCard, Package, Rocket, Store, type LucideIcon } from "lucide-react";

import type { ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

// The four setup steps as the onboarding screen and the setup wizard show them (D-079, D-080),
// with copy from the founder's reference screen.
export const SETUP_STEP_META: Record<ChecklistItemId, { title: string; text: string; icon: LucideIcon }> = {
  "store-setup": { title: "Store Details", text: "Add your store name, logo and basic info.", icon: Store },
  "first-product": { title: "Add Products", text: "List your first product to start selling.", icon: Package },
  "connect-payments": { title: "Set Payments", text: "Connect a payment method to receive orders.", icon: CreditCard },
  publish: { title: "Go Live", text: "Publish your store and start selling.", icon: Rocket },
};

/**
 * A step's icon tile with its number badge. Done = mint check, current = blue number on a blue-soft
 * tile, the rest gray. Same soft 1px card border and radius as every card (D-080). Decoration only:
 * the step's text says the same for screen readers.
 */
export function StepTile({
  id,
  number,
  done,
  current,
  size = "md",
  onTint = false,
}: {
  id: ChecklistItemId;
  number: number;
  done: boolean;
  current: boolean;
  size?: "sm" | "md";
  /** The tile sits on a blue-soft row: keep it white so it stands out. */
  onTint?: boolean;
}) {
  const Icon = SETUP_STEP_META[id].icon;
  return (
    <span aria-hidden="true" className="relative shrink-0">
      <span
        className={cn(
          "flex items-center justify-center rounded-lg border border-line",
          size === "sm" ? "size-12" : "size-14 sm:size-18",
          current ? (onTint ? "bg-surface text-blue" : "bg-blue-soft text-blue") : "bg-surface text-ink",
        )}
      >
        <Icon className={size === "sm" ? "size-5" : "size-6 sm:size-7"} strokeWidth={1.75} />
      </span>
      <span
        className={cn(
          "absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-surface text-xs font-extrabold",
          done ? "bg-mint text-surface" : current ? "bg-blue text-on-blue" : "bg-mute text-surface",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : number}
      </span>
    </span>
  );
}
