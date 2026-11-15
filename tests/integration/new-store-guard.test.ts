import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// Phase A (D-071) on a real MongoDB: the unique indexes and counters behind "one store per inbox",
// the per-browser limit and "one Stripe account per store".

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));

import { emailHasAccount } from "@/lib/auth/accounts";
import { STORE_CREATION_LIMITS } from "@/lib/config";
import { getDb } from "@/lib/db/mongo";
import { createDraftStore } from "@/lib/stores/create-draft-store";
import { checkNewStore, recordNewStore } from "@/lib/stores/new-store-guard";
import { setStoreStripeConnection } from "@/lib/stores/queries";

const slug = () => `s${randomUUID().slice(0, 8)}`;
const connection = (accountId: string) => ({ accountId, livemode: false, status: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true } });

describe("one store per inbox", () => {
  it("refuses a second store for a Gmail alias of an existing owner (unique index)", async () => {
    expect(await createDraftStore(randomUUID(), slug(), "priya.shah@gmail.com")).toBe("created");
    expect(await createDraftStore(randomUUID(), slug(), "PriyaShah+shop2@googlemail.com")).toBe("email_used");
  });

  it("the gate says so before trying, but never blocks the owner's own store", async () => {
    const owner = randomUUID();
    expect(await createDraftStore(owner, slug(), "ravi@example.com")).toBe("created");
    expect(await checkNewStore({ ownerId: randomUUID(), email: "ravi+2@example.com", device: null, ipHash: null })).toMatchObject({ ok: false, reason: "email_used" });
    expect(await checkNewStore({ ownerId: owner, email: "ravi@example.com", device: null, ipHash: null })).toEqual({ ok: true });
  });

  it("refuses throwaway inboxes", async () => {
    expect(await checkNewStore({ ownerId: randomUUID(), email: "x@yopmail.com", device: null, ipHash: null })).toMatchObject({ ok: false, reason: "disposable" });
  });
});

describe("stores per browser and IP", () => {
  it("allows the limit, then asks to contact support", async () => {
    const device = randomUUID();
    const check = () => checkNewStore({ ownerId: randomUUID(), email: `${randomUUID()}@example.com`, device, ipHash: null });
    for (let i = 0; i < STORE_CREATION_LIMITS.perDevice; i++) {
      expect(await check()).toEqual({ ok: true });
      await recordNewStore({ device, ipHash: null });
    }
    expect(await check()).toMatchObject({ ok: false, reason: "limit" });
    // Another browser is not affected.
    expect(await checkNewStore({ ownerId: randomUUID(), email: `${randomUUID()}@example.com`, device: randomUUID(), ipHash: null })).toEqual({ ok: true });
  });

  it("has a separate, higher limit per IP", async () => {
    const ipHash = randomUUID();
    for (let i = 0; i < STORE_CREATION_LIMITS.perIp; i++) await recordNewStore({ device: randomUUID(), ipHash });
    expect(await checkNewStore({ ownerId: randomUUID(), email: `${randomUUID()}@example.com`, device: randomUUID(), ipHash })).toMatchObject({ ok: false, reason: "limit" });
  });
});

describe("emailHasAccount", () => {
  it("finds the exact email in Better Auth's users and an alias of a store owner", async () => {
    const db = await getDb();
    await db.collection("user").insertOne({ _id: randomUUID() as never, email: "neha@example.com", name: "Neha" });
    expect(await emailHasAccount("Neha@Example.com")).toBe(true);
    expect(await createDraftStore(randomUUID(), slug(), "arjun.k@gmail.com")).toBe("created");
    expect(await emailHasAccount("arjunk+new@gmail.com")).toBe(true);
    expect(await emailHasAccount("someone-new@example.com")).toBe(false);
  });
});

describe("one Stripe account per store", () => {
  async function newOwner() {
    const owner = randomUUID();
    expect(await createDraftStore(owner, slug(), `${randomUUID()}@example.com`)).toBe("created");
    return owner;
  }

  it("refuses a real Connect account already claimed by another store, until it is released", async () => {
    const [a, b] = [await newOwner(), await newOwner()];
    const account = `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    expect(await setStoreStripeConnection(a, connection(account), { exclusive: true })).toEqual({ previousAccountId: null });
    expect(await setStoreStripeConnection(b, connection(account), { exclusive: true })).toBe("in_use");

    expect(await setStoreStripeConnection(a, null)).toEqual({ previousAccountId: account });
    expect(await setStoreStripeConnection(b, connection(account), { exclusive: true })).toEqual({ previousAccountId: null });
  });

  it("lets the test-mode shortcut share the founder's account (not exclusive)", async () => {
    const [a, b] = [await newOwner(), await newOwner()];
    const platform = `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    expect(await setStoreStripeConnection(a, connection(platform))).toEqual({ previousAccountId: null });
    expect(await setStoreStripeConnection(b, connection(platform))).toEqual({ previousAccountId: null });
  });

  it("a store may reconnect its own account", async () => {
    const a = await newOwner();
    const account = `acct_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await setStoreStripeConnection(a, connection(account), { exclusive: true });
    expect(await setStoreStripeConnection(a, connection(account), { exclusive: true })).toEqual({ previousAccountId: account });
  });
});
