import { describe, expect, it } from "vitest";

import { planStatusLabel } from "@/components/dashboard/sidebar-footer";
import type { StoreAccess } from "@/lib/plans/access";

const access = (state: StoreAccess["state"], plan: StoreAccess["plan"] = null): StoreAccess => ({ state, plan, endsAt: null, daysLeft: null, cancelsAtPeriodEnd: false });

describe("planStatusLabel", () => {
  it("says the creator's real plan instead of a fixed 'Free plan'", () => {
    expect(planStatusLabel(access("trial"))).toBe("Free trial");
    expect(planStatusLabel(access("founding"))).toBe("Founding creator");
    expect(planStatusLabel(access("paused"))).toBe("Store paused");
    expect(planStatusLabel(access("past_due", "starter"))).toBe("Payment due");
    expect(planStatusLabel(access("active", "starter"))).toBe("Starter plan");
    expect(planStatusLabel(access("active", "pro"))).toBe("Pro plan");
  });
});
