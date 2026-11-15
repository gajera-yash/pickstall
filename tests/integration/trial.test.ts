import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

// The free trial on a real MongoDB (D-072): new stores get one, and a store whose trial has ended is
// closed to buyers on every public path while its data stays as it is.

import { TRIAL_DAYS } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { canBuy, loadCheckoutContext } from "@/lib/orders/queries";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { findPublicStore } from "@/lib/stores/public";
import { findStoreByOwner } from "@/lib/stores/queries";

import { seedProduct, seedStore } from "./fixtures";

describe("free trial", () => {
  it("gives a new store a trial of TRIAL_DAYS", async () => {
    const owner = randomUUID();
    const before = Date.now();
    expect(await createDraftStore(owner, `t${randomUUID().slice(0, 8)}`, `${randomUUID()}@example.com`)).toBe("created");
    const store = await findStoreByOwner(owner);
    expect(store?.access.state).toBe("trial");
    expect(store?.access.daysLeft).toBe(TRIAL_DAYS);
    const { stores } = await collections();
    const doc = await stores.findOne({ ownerId: owner });
    expect(doc?.planTier).toBe("trial");
    expect((doc?.trialEndsAt?.getTime() ?? 0) - before).toBeGreaterThanOrEqual(TRIAL_DAYS * 24 * 60 * 60 * 1000 - 5_000);
  });

  it("closes a store whose trial has ended to buyers, free products included", async () => {
    const store = await seedStore({ planTier: "trial", trialEndsAt: new Date(Date.now() - 60_000) });
    const product = await seedProduct(store._id, { priceCents: 0 });
    expect((await findPublicStore(store.slug))?.isOpen).toBe(false);
    const context = await loadCheckoutContext(store.slug, product.slug);
    expect(context?.open).toBe(false);
    expect(context && canBuy(context)).toBe(false);
    // Nothing is deleted or unpublished: the store and product are still there.
    expect(context?.product.id).toBe(product._id);
  });

  it("keeps a founding store open after its trial date", async () => {
    const store = await seedStore({ planTier: "founding", foundingEndsAt: new Date(Date.now() + 86_400_000), trialEndsAt: new Date(Date.now() - 86_400_000) });
    expect((await findPublicStore(store.slug))?.isOpen).toBe(true);
  });
});
