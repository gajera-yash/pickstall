import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

// Platform billing on a real MongoDB (D-073): stores.billing is written only from Stripe's
// subscription state, one Stripe customer per store, and late events cannot undo a newer plan.

import type { SubscriptionState } from "@/lib/payments/billing";
import { applySubscriptionState, billingOfOwner } from "@/lib/plans/billing-queries";
import { findPublicStore } from "@/lib/stores/public";
import { findStoreByOwner } from "@/lib/stores/queries";

import { seedStore } from "./fixtures";

const expired = { planTier: "trial" as const, trialEndsAt: new Date(Date.now() - 86_400_000) };
const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 14)}`;

function state(storeId: string | null, extra: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    subscriptionId: id("sub"),
    customerId: id("cus"),
    storeId,
    plan: "starter",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    cancelAtPeriodEnd: false,
    ...extra,
  };
}

describe("applySubscriptionState", () => {
  it("opens a paused store when its subscription becomes active, and is safe to repeat", async () => {
    const store = await seedStore(expired);
    expect((await findPublicStore(store.slug))?.isOpen).toBe(false);

    const active = state(store._id);
    expect(await applySubscriptionState(active)).toBe("applied");
    expect(await applySubscriptionState(active)).toBe("applied");

    expect((await findPublicStore(store.slug))?.isOpen).toBe(true);
    expect((await findStoreByOwner(store.ownerId))?.access).toMatchObject({ state: "active", plan: "starter" });
    expect(await billingOfOwner(store.ownerId)).toMatchObject({ customerId: active.customerId, subscriptionId: active.subscriptionId, status: "active" });
  });

  it("never exposes billing ids in public reads", async () => {
    const store = await seedStore(expired);
    const active = state(store._id);
    await applySubscriptionState(active);
    const text = JSON.stringify(await findPublicStore(store.slug));
    expect(text).not.toContain(active.customerId);
    expect(text).not.toContain(active.subscriptionId);
  });

  it("pauses the store again when the subscription is cancelled for good", async () => {
    const store = await seedStore(expired);
    const active = state(store._id);
    await applySubscriptionState(active);
    await applySubscriptionState({ ...active, status: "canceled" });
    expect((await findPublicStore(store.slug))?.isOpen).toBe(false);
  });

  it("does not let a late event of an old, cancelled subscription undo the new one", async () => {
    const store = await seedStore(expired);
    const customerId = id("cus");
    const old = state(store._id, { customerId });
    const fresh = state(store._id, { customerId, plan: "pro" });
    await applySubscriptionState(old);
    await applySubscriptionState(fresh);
    expect(await applySubscriptionState({ ...old, status: "canceled" })).toBe("ignored");
    expect((await findStoreByOwner(store.ownerId))?.access).toMatchObject({ state: "active", plan: "pro" });
  });

  it("only accepts the store's own Stripe customer once it has one", async () => {
    const store = await seedStore(expired);
    await applySubscriptionState(state(store._id));
    expect(await applySubscriptionState(state(store._id, { plan: "pro" }))).toBe("ignored");
    expect((await findStoreByOwner(store.ownerId))?.access.plan).toBe("starter");
  });

  it("keeps one Stripe customer to one store", async () => {
    const [a, b] = [await seedStore(expired), await seedStore(expired)];
    const shared = state(a._id);
    await applySubscriptionState(shared);
    expect(await applySubscriptionState({ ...state(b._id), customerId: shared.customerId })).toBe("conflict");
    expect((await findPublicStore(b.slug))?.isOpen).toBe(false);
  });

  it("ignores a subscription that names no store", async () => {
    expect(await applySubscriptionState(state(null))).toBe("ignored");
  });
});
