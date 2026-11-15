import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Download my data and Delete account on a real MongoDB (D-074). Stripe is mocked; the database rules
// (owner filter, anonymised store, tombstone, no second trial) run for real.

const stripe = vi.hoisted(() => ({ cancelSubscriptionNow: vi.fn(async () => undefined), releaseAccount: vi.fn(async () => undefined) }));
vi.mock("@/lib/payments/billing", async () => ({ ...(await vi.importActual<object>("@/lib/payments/billing")), cancelSubscriptionNow: stripe.cancelSubscriptionNow }));
vi.mock("@/lib/stores/stripe-connect", () => ({ releaseAccount: stripe.releaseAccount }));

import { AccountDeletionBlocked, prepareAccountDeletion } from "@/lib/account/delete-account";
import { exportUserData } from "@/lib/account/export";
import { collections } from "@/lib/db/collections";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { findStoreByOwner } from "@/lib/stores/queries";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

beforeEach(() => {
  vi.clearAllMocks();
});

async function creator(email: string, extra: Parameters<typeof seedStore>[0] = {}) {
  const store = await seedStore({ ownerEmailKey: email, ...extra });
  const { profiles } = await collections();
  await profiles.insertOne({ _id: store.ownerId, email, fullName: "Maya Patel", phone: "+14155550100", createdAt: new Date(), updatedAt: new Date() });
  const product = await seedProduct(store._id);
  return { store, product };
}

describe("exportUserData", () => {
  it("contains the person's own profile, store, products, sales and purchases, and nobody else's", async () => {
    const email = `maya-${randomUUID().slice(0, 6)}@example.com`;
    const { store, product } = await creator(email);
    const other = await creator(`other-${randomUUID().slice(0, 6)}@example.com`);
    await seedOrder(product, { buyerEmail: "buyer@example.com" });
    await seedOrder(other.product, { buyerEmail: email, item: { title: "Bought elsewhere", unitPriceCents: 900 } });
    await seedOrder(other.product, { buyerEmail: "stranger@example.com" });

    const data = await exportUserData({ id: store.ownerId, email });
    expect(data.profile).toMatchObject({ fullName: "Maya Patel" });
    expect(data.store).toMatchObject({ _id: store._id });
    expect(data.store).not.toHaveProperty("ownerEmailKey");
    expect(data.products.map((p) => p._id)).toEqual([product._id]);
    expect(data.salesAsCreator).toHaveLength(1);
    expect(data.purchasesAsBuyer.map((p) => (p.item as { title: string }).title)).toEqual(["Bought elsewhere"]);
    // Other people's data stays out: the other store's own products, sales and buyers.
    expect(JSON.stringify(data)).not.toContain("stranger@example.com");
    expect(JSON.stringify(data)).not.toContain(other.product.slug);
  });
});

describe("prepareAccountDeletion", () => {
  it("cancels the plan, disconnects Stripe, anonymises the store, removes the profile and keeps buyers' products", async () => {
    const email = `del-${randomUUID().slice(0, 6)}@example.com`;
    const { store, product } = await creator(email, {
      isPublished: true,
      stripeAccountId: "acct_creator123",
      billing: { customerId: `cus_${randomUUID().slice(0, 8)}`, subscriptionId: "sub_live1", plan: "starter", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false, updatedAt: new Date() },
    });

    await prepareAccountDeletion({ id: store.ownerId, email });

    expect(stripe.cancelSubscriptionNow).toHaveBeenCalledWith("sub_live1");
    expect(stripe.releaseAccount).toHaveBeenCalledWith(store.ownerId, "acct_creator123");
    const { stores, products, profiles, deletedAccounts } = await collections();
    const after = await stores.findOne({ _id: store._id });
    expect(after).toMatchObject({ name: "Deleted store", bio: null, avatarUrl: null, isPublished: false, stripeAccountId: null });
    expect(after?.slug).toMatch(/^deleted-/);
    expect(after?.ownerEmailKey).toBeUndefined();
    expect(after?.deletedAt).toBeInstanceOf(Date);
    const kept = await products.findOne({ _id: product._id });
    expect(kept?.status).toBe("draft");
    expect(kept?.externalUrl).toBe(product.externalUrl); // buyers keep what they paid for
    expect(await profiles.findOne({ _id: store.ownerId })).toBeNull();
    expect(await deletedAccounts.countDocuments()).toBeGreaterThan(0);
    expect(JSON.stringify(await deletedAccounts.find().toArray())).not.toContain(email);
  });

  it("stops (and changes nothing) when Stripe cannot cancel the plan", async () => {
    const email = `stuck-${randomUUID().slice(0, 6)}@example.com`;
    const { store } = await creator(email, {
      billing: { customerId: `cus_${randomUUID().slice(0, 8)}`, subscriptionId: "sub_x", plan: "pro", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false, updatedAt: new Date() },
    });
    stripe.cancelSubscriptionNow.mockRejectedValueOnce(new Error("stripe down"));
    await expect(prepareAccountDeletion({ id: store.ownerId, email })).rejects.toBeInstanceOf(AccountDeletionBlocked);
    const { stores, profiles } = await collections();
    expect((await stores.findOne({ _id: store._id }))?.slug).toBe(store.slug);
    expect(await profiles.findOne({ _id: store.ownerId })).not.toBeNull();
  });

  it("frees the email for a new store, but without a second free trial", async () => {
    const email = `again-${randomUUID().slice(0, 6)}@gmail.com`;
    const { store } = await creator(email);
    await prepareAccountDeletion({ id: store.ownerId, email });

    const newOwner = randomUUID();
    expect(await createDraftStore(newOwner, `n${randomUUID().slice(0, 8)}`, email)).toBe("created");
    expect((await findStoreByOwner(newOwner))?.access.state).toBe("paused");
  });

  it("works for a buyer without a store", async () => {
    const id = randomUUID();
    const { profiles } = await collections();
    await profiles.insertOne({ _id: id, email: "buyer-only@example.com", fullName: "Buyer", phone: null, createdAt: new Date(), updatedAt: new Date() });
    await prepareAccountDeletion({ id, email: "buyer-only@example.com" });
    expect(await profiles.findOne({ _id: id })).toBeNull();
    expect(stripe.cancelSubscriptionNow).not.toHaveBeenCalled();
  });
});
