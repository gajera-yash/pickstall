import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// Coupons (D-088) on a real MongoDB: the use limit holds when many buyers check out at once, a
// once-per-email code refuses a second use, a failed payment gives the use back, a paid one keeps
// it (redeemed through the webhook), and stores never see each other's coupons.

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});

import { createCoupon, findCouponByCode, holdCoupon, listCoupons, setCouponActive } from "@/lib/coupons/queries";
import { couponInputFor } from "@/lib/coupons/rules";
import { collections } from "@/lib/db/collections";
import { markOrderFailed } from "@/lib/orders/queries";
import { signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

const input = (overrides: Record<string, unknown> = {}) =>
  couponInputFor("usd").parse({ code: `C${randomUUID().slice(0, 6)}`, kind: "percent", percentOff: "10", amountOff: "", productIds: null, maxRedemptions: "", oncePerEmail: false, expiresAt: "", ...overrides });

async function setup() {
  const store = await seedStore();
  const product = await seedProduct(store._id);
  return { store, product };
}

async function count(couponId: string) {
  const { coupons } = await collections();
  return (await coupons.findOne({ _id: couponId }))?.redemptionCount;
}

describe("coupon uses", () => {
  it("never goes over the limit when many buyers check out at once", async () => {
    const { store, product } = await setup();
    const created = await createCoupon(store._id, input({ maxRedemptions: "3" }));
    if (typeof created === "string") throw new Error(created);
    const orders = await Promise.all(Array.from({ length: 8 }, () => seedOrder(product, { status: "pending", paidAt: null })));
    const results = await Promise.all(orders.map((order, index) => holdCoupon({ storeId: store._id, couponId: created.id, orderId: order._id, email: `b${index}@example.com` })));
    expect(results.filter((result) => result === "held")).toHaveLength(3);
    expect(results.filter((result) => result === "used_up")).toHaveLength(5);
    expect(await count(created.id)).toBe(3);
  });

  it("lets each email use a once-per-buyer code once", async () => {
    const { store, product } = await setup();
    const created = await createCoupon(store._id, input({ oncePerEmail: true }));
    if (typeof created === "string") throw new Error(created);
    const [a, b] = await Promise.all([seedOrder(product, { status: "pending", paidAt: null }), seedOrder(product, { status: "pending", paidAt: null })]);
    expect(await holdCoupon({ storeId: store._id, couponId: created.id, orderId: a._id, email: "Ravi@Example.com" })).toBe("held");
    expect(await holdCoupon({ storeId: store._id, couponId: created.id, orderId: b._id, email: "ravi@example.com " })).toBe("already_used");
    expect(await count(created.id)).toBe(1);
  });

  it("gives the use back when the payment fails, and keeps it when the order is paid", async () => {
    const { store, product } = await setup();
    const created = await createCoupon(store._id, input({ maxRedemptions: "1", oncePerEmail: true }));
    if (typeof created === "string") throw new Error(created);
    const failed = await seedOrder(product, { status: "pending", paidAt: null });
    await holdCoupon({ storeId: store._id, couponId: created.id, orderId: failed._id, email: "a@example.com" });
    await markOrderFailed(failed._id);
    expect(await count(created.id)).toBe(0);

    const paid = await seedOrder(product, { status: "pending", paidAt: null });
    expect(await holdCoupon({ storeId: store._id, couponId: created.id, orderId: paid._id, email: "a@example.com" })).toBe("held");
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.succeeded", orderId: paid._id });
    expect((await handleWebhookRequest("mock", body, signMockBody(body))).status).toBe(200);
    const { couponRedemptions } = await collections();
    expect((await couponRedemptions.findOne({ orderId: paid._id }))?.status).toBe("redeemed");
    expect(await count(created.id)).toBe(1);
  });

  it("refuses a code that is off, expired or used up", async () => {
    const { store, product } = await setup();
    const created = await createCoupon(store._id, input({ expiresAt: "2001-01-01T00:00:00.000Z" }));
    if (typeof created === "string") throw new Error(created);
    const order = await seedOrder(product, { status: "pending", paidAt: null });
    expect(await holdCoupon({ storeId: store._id, couponId: created.id, orderId: order._id, email: "x@example.com" })).toBe("used_up");
  });
});

describe("coupons stay inside their store", () => {
  it("finds, lists and changes only this store's coupons, and refuses a duplicate code", async () => {
    const a = await setup();
    const b = await setup();
    const code = `SAME${randomUUID().slice(0, 4)}`.toUpperCase();
    const created = await createCoupon(a.store._id, input({ code }));
    if (typeof created === "string") throw new Error(created);
    expect(await createCoupon(a.store._id, input({ code: code.toLowerCase() }))).toBe("taken");
    expect(typeof (await createCoupon(b.store._id, input({ code })))).toBe("object");

    expect((await findCouponByCode(a.store._id, code.toLowerCase()))?._id).toBe(created.id);
    expect((await listCoupons(b.store._id)).some((coupon) => coupon._id === created.id)).toBe(false);
    expect(await setCouponActive(b.store._id, created.id, false)).toBe(false);
    expect(await setCouponActive(a.store._id, created.id, false)).toBe(true);
    // Another store's product cannot be named.
    expect(await createCoupon(a.store._id, input({ productIds: [b.product._id] }))).toBe("bad_products");
    // Nor can another store hold a use of it.
    const order = await seedOrder(b.product, { status: "pending", paidAt: null });
    expect(await holdCoupon({ storeId: b.store._id, couponId: created.id, orderId: order._id, email: "x@example.com" })).toBe("used_up");
  });
});
