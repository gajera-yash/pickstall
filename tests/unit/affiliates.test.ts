import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, storeQueries, userId, OPEN_ACCESS } from "./auth-mocks";

// D-113: affiliate rules, store-scoped queries, the commission math and the creator actions.

const db = vi.hoisted(() => {
  const coll = () => ({ find: vi.fn(), findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() });
  return { affiliates: coll(), affiliatePayouts: coll(), orders: coll() };
});
const Duplicate = vi.hoisted(() => class Duplicate extends Error {});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => error instanceof Duplicate }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createAffiliateAction, recordAffiliatePayoutAction, setAffiliateActiveAction } from "@/lib/affiliates/actions";
import { affiliateForCheckout, affiliateTotals, createAffiliate } from "@/lib/affiliates/queries";
import { affiliateCodeOf, affiliateInput, commissionCents, payoutInputFor } from "@/lib/affiliates/rules";

const AFF = "aaaaaaaa-0000-4000-8000-000000000001";
const input = { name: " Asha <b>Patel</b> ", email: "", code: " Asha-1 ", commissionPercent: 30 };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue({ access: OPEN_ACCESS, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  db.affiliates.countDocuments.mockResolvedValue(0);
  db.affiliates.insertOne.mockResolvedValue({});
  db.affiliates.updateOne.mockResolvedValue({ matchedCount: 1 });
  db.affiliatePayouts.insertOne.mockResolvedValue({});
});

describe("affiliate rules", () => {
  it("clean the name, lower-case the code and check the rate", () => {
    expect(affiliateInput.parse(input)).toEqual({ name: "Asha Patel", email: null, code: "asha-1", commissionPercent: 30 });
    expect(affiliateInput.safeParse({ ...input, code: "a" }).success).toBe(false);
    expect(affiliateInput.safeParse({ ...input, code: "-asha" }).success).toBe(false);
    expect(affiliateInput.safeParse({ ...input, commissionPercent: 95 }).success).toBe(false);
    expect(affiliateInput.safeParse({ ...input, commissionPercent: 10.5 }).success).toBe(false);
    expect(affiliateInput.safeParse({ ...input, email: "not-an-email" }).success).toBe(false);
  });

  it("read a code from a link only when it looks like one", () => {
    expect(affiliateCodeOf(" ASHA ")).toBe("asha");
    expect(affiliateCodeOf("<script>")).toBeNull();
    expect(affiliateCodeOf(42)).toBeNull();
  });

  it("take the commission from what was kept after refunds, rounded down", () => {
    expect(commissionCents(1999, 0, 30)).toBe(599);
    expect(commissionCents(2000, 500, 10)).toBe(150);
    expect(commissionCents(1000, 2000, 50)).toBe(0);
  });

  it("accept a positive payout amount in the store's currency and an optional cleaned note", () => {
    expect(payoutInputFor("usd").parse({ amount: "12.50", note: " <i>bank</i> " })).toEqual({ amount: 1250, note: "bank" });
    expect(payoutInputFor("usd").parse({ amount: "5", note: "" })).toEqual({ amount: 500, note: null });
    expect(payoutInputFor("usd").safeParse({ amount: "0", note: "" }).success).toBe(false);
    expect(payoutInputFor("usd").safeParse({ amount: "-3", note: "" }).success).toBe(false);
  });
});

describe("affiliate queries", () => {
  it("create one per code in the store, and stop at the limit", async () => {
    expect(await createAffiliate("store-1", affiliateInput.parse(input))).toMatchObject({ id: expect.any(String) });
    expect(db.affiliates.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1", code: "asha-1", codeKey: "asha-1", active: true }));
    db.affiliates.insertOne.mockRejectedValueOnce(new Duplicate());
    expect(await createAffiliate("store-1", affiliateInput.parse(input))).toBe("taken");
    db.affiliates.countDocuments.mockResolvedValue(50);
    expect(await createAffiliate("store-1", affiliateInput.parse(input))).toBe("limit");
  });

  it("find a checkout code only among this store's active affiliates", async () => {
    db.affiliates.findOne.mockResolvedValue({ _id: AFF, code: "asha", commissionPercent: 30 });
    expect(await affiliateForCheckout("store-1", " Asha ")).toEqual({ affiliateId: AFF, code: "asha", commissionPercent: 30 });
    expect(db.affiliates.findOne.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", codeKey: "asha", active: true });
    expect(await affiliateForCheckout("store-1", "<bad>")).toBeNull();
    expect(db.affiliates.findOne).toHaveBeenCalledTimes(1);
  });

  it("total each affiliate's paid orders, commission and recorded payouts for this store", async () => {
    db.orders.aggregate.mockReturnValue({ toArray: async () => [{ _id: AFF, orders: 2, salesCents: 3000, commissionCents: 900 }] });
    db.affiliatePayouts.aggregate.mockReturnValue({ toArray: async () => [{ _id: AFF, paidCents: 500 }] });
    const totals = await affiliateTotals("store-1", "usd");
    expect(totals.get(AFF)).toEqual({ orders: 2, salesCents: 3000, commissionCents: 900, paidCents: 500 });
    const match = (db.orders.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[])[0];
    expect(match).toEqual({ $match: { storeId: "store-1", status: "paid", currency: "usd", "affiliate.affiliateId": { $type: "string" }, bumpOf: null } });
    expect((db.affiliatePayouts.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[])[0]).toEqual({ $match: { storeId: "store-1", currency: "usd" } });
  });
});

describe("affiliate actions", () => {
  it("add an affiliate to the session's store only", async () => {
    expect(await createAffiliateAction(input)).toMatchObject({ ok: true });
    expect(db.affiliates.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1" }));
    expect(await createAffiliateAction({ ...input, storeId: "store-2" })).toMatchObject({ ok: true });
    expect(db.affiliates.insertOne.mock.calls[1]?.[0].storeId).toBe("store-1");
    expect(await createAffiliateAction({ ...input, commissionPercent: 0 })).toMatchObject({ ok: false, field: "commissionPercent" });
    db.affiliates.insertOne.mockRejectedValueOnce(new Duplicate());
    expect(await createAffiliateAction(input)).toMatchObject({ ok: false, field: "code" });
  });

  it("pause and resume only this store's affiliate", async () => {
    expect(await setAffiliateActiveAction(AFF, false)).toEqual({ ok: true, data: { active: false } });
    expect(db.affiliates.updateOne.mock.calls[0]?.[0]).toEqual({ _id: AFF, storeId: "store-1" });
    db.affiliates.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await setAffiliateActiveAction(AFF, true)).toMatchObject({ ok: false });
    expect(await setAffiliateActiveAction("not-a-uuid", true)).toMatchObject({ ok: false });
  });

  it("record a payout only for this store's affiliate, in the store's currency", async () => {
    db.affiliates.countDocuments.mockResolvedValue(1);
    expect(await recordAffiliatePayoutAction(AFF, { amount: "25", note: "Nov" })).toEqual({ ok: true, data: { amountCents: 2500 } });
    expect(db.affiliates.countDocuments.mock.calls[0]?.[0]).toEqual({ _id: AFF, storeId: "store-1" });
    expect(db.affiliatePayouts.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1", affiliateId: AFF, amountCents: 2500, currency: "usd", note: "Nov" }));
    db.affiliates.countDocuments.mockResolvedValue(0);
    expect(await recordAffiliatePayoutAction(AFF, { amount: "25", note: "" })).toMatchObject({ ok: false });
    expect(await recordAffiliatePayoutAction(AFF, { amount: "abc", note: "" })).toMatchObject({ ok: false, field: "amount" });
    expect(db.affiliatePayouts.insertOne).toHaveBeenCalledTimes(1);
  });
});
