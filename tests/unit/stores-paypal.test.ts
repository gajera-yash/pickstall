import { beforeEach, describe, expect, it, vi } from "vitest";

// A store's PayPal app (D-118): writes are scoped by the session owner, the secret is stored
// encrypted, and an app in the other mode is never used.

const hoisted = vi.hoisted(() => ({
  stores: { findOne: vi.fn(), updateOne: vi.fn(), findOneAndUpdate: vi.fn() },
  mode: "sandbox" as "sandbox" | "live",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ stores: hoisted.stores })) }));
vi.mock("@/lib/payments/paypal-config", () => ({ credentialsKey: () => Buffer.alloc(32, 3).toString("base64"), paypalMode: () => hoisted.mode }));

import { paypalCredentialsOfStore, removePayPalConnection, savePayPalConnection } from "@/lib/stores/paypal";

const OWNER_A = "owner-a";
const STORE_A = "11111111-1111-4111-8111-111111111111";
const credentials = { mode: "sandbox" as const, clientId: "C".repeat(30), secret: "very-secret-value-0001" };

describe("store PayPal connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mode = "sandbox";
  });

  it("saves only on the owner's own store, with the secret encrypted", async () => {
    hoisted.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await savePayPalConnection(OWNER_A, STORE_A, { credentials, webhookId: "WH-1" })).toBe(true);
    const [filter, update] = hoisted.stores.updateOne.mock.calls[0] as [Record<string, unknown>, { $set: { paypal: { secretSealed: string; clientId: string } } }];
    expect(filter).toEqual({ _id: STORE_A, ownerId: OWNER_A });
    expect(update.$set.paypal.clientId).toBe(credentials.clientId);
    expect(JSON.stringify(update)).not.toContain(credentials.secret);
  });

  it("creator A cannot save onto creator B's store (no match, nothing written)", async () => {
    hoisted.stores.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await savePayPalConnection(OWNER_A, "22222222-2222-4222-8222-222222222222", { credentials, webhookId: null })).toBe(false);
  });

  it("removes only the owner's connection", async () => {
    hoisted.stores.findOneAndUpdate.mockResolvedValue(null);
    expect(await removePayPalConnection(OWNER_A)).toBeNull();
    expect(hoisted.stores.findOneAndUpdate).toHaveBeenCalledWith({ ownerId: OWNER_A, paypal: { $exists: true } }, expect.anything(), expect.anything());
  });

  it("returns the decrypted app for its store, and nothing for the other mode", async () => {
    hoisted.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    await savePayPalConnection(OWNER_A, STORE_A, { credentials, webhookId: "WH-1" });
    const saved = (hoisted.stores.updateOne.mock.calls[0] as [unknown, { $set: { paypal: unknown } }])[1].$set.paypal;
    hoisted.stores.findOne.mockResolvedValue({ _id: STORE_A, paypal: saved });
    expect(await paypalCredentialsOfStore(STORE_A)).toEqual({ storeId: STORE_A, credentials, webhookId: "WH-1" });
    expect(hoisted.stores.findOne).toHaveBeenCalledWith({ _id: STORE_A, paypal: { $exists: true } }, expect.anything());
    hoisted.mode = "live";
    expect(await paypalCredentialsOfStore(STORE_A)).toBeNull();
  });

  it("a secret sealed for another store does not open here", async () => {
    hoisted.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    await savePayPalConnection(OWNER_A, STORE_A, { credentials, webhookId: "WH-1" });
    const saved = (hoisted.stores.updateOne.mock.calls[0] as [unknown, { $set: { paypal: unknown } }])[1].$set.paypal;
    hoisted.stores.findOne.mockResolvedValue({ _id: "22222222-2222-4222-8222-222222222222", paypal: saved });
    expect(await paypalCredentialsOfStore("22222222-2222-4222-8222-222222222222")).toBeNull();
  });
});
