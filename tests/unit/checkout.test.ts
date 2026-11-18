import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, rateLimit, redirectOf } from "./auth-mocks";

const hoisted = vi.hoisted(() => {
  class DuplicateKey extends Error {}
  return {
    DuplicateKey,
    seen: new Set<string>(),
    orders: { findOne: vi.fn(), updateOne: vi.fn() },
    queries: {
      attachProviderSession: vi.fn(),
      canBuy: vi.fn(),
      createPendingOrder: vi.fn(),
      findPendingMockOrder: vi.fn(),
      loadCheckoutContext: vi.fn(),
      markOrderFailed: vi.fn(),
      productPathForOrder: vi.fn(),
    },
    providerForStore: vi.fn(),
    markFreeOrderPaid: vi.fn(),
    bumps: { findCheckoutBump: vi.fn(async (): Promise<unknown> => null), createBumpOrder: vi.fn(async () => null), refundBumpOrder: vi.fn() },
    coupons: { findCouponByCode: vi.fn(async (): Promise<unknown> => null), holdCoupon: vi.fn(async (): Promise<string> => "held"), releaseCouponForOrder: vi.fn(), redeemCouponForOrder: vi.fn() },
    bookings: { busyTimesForStore: vi.fn<(storeId: string) => Promise<{ start: Date; end: Date }[]>>(async () => []), holdSlot: vi.fn(async () => "held"), confirmBookingForOrder: vi.fn(async () => null), releaseBookingForOrder: vi.fn() },
  };
});

vi.mock("@/lib/env.server", () => ({ serverEnv: { BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-hmac" } }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => error instanceof hoisted.DuplicateKey }));
vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({
    orders: hoisted.orders,
    webhookEvents: {
      insertOne: vi.fn(async (doc: { _id: string }) => {
        if (hoisted.seen.has(doc._id)) throw new hoisted.DuplicateKey("dup");
        hoisted.seen.add(doc._id);
      }),
      deleteOne: vi.fn(async ({ _id }: { _id: string }) => void hoisted.seen.delete(_id)),
    },
  })),
}));
vi.mock("@/lib/orders/queries", () => hoisted.queries);
// Coaching bookings (D-083) have their own integration tests on a real MongoDB.
vi.mock("@/lib/coaching/bookings", () => hoisted.bookings);
vi.mock("@/lib/coupons/queries", () => hoisted.coupons);
vi.mock("@/lib/bumps/queries", () => hoisted.bumps);
vi.mock("@/lib/coaching/calls", () => ({ cancelBookingOfRefundedOrder: vi.fn(async () => undefined) }));
vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments");
  return { ...actual, providerForStore: hoisted.providerForStore };
});
vi.mock("@/lib/payments/stripe", () => ({ stripeConfigured: () => false, stripeProvider: { name: "stripe" } }));

import type { CheckoutQuestionDoc } from "@/lib/db/collections";
import { validateAnswers } from "@/lib/orders/answers";
import { startCheckout, confirmMockPayment } from "@/lib/orders/actions";
import { orderAmounts } from "@/lib/orders/pricing";
import { buyerInput } from "@/lib/orders/schemas";
import { mockAllowed, mockProvider, signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

describe("orderAmounts (D-047)", () => {
  it("charges the regular price without a discount", () => {
    expect(orderAmounts({ priceCents: 1900, salePriceCents: null })).toEqual({ subtotalCents: 1900, discountCents: 0, totalCents: 1900 });
  });

  it("charges the discounted price and records the discount", () => {
    expect(orderAmounts({ priceCents: 2900, salePriceCents: 1900 })).toEqual({ subtotalCents: 2900, discountCents: 1000, totalCents: 1900 });
  });

  it("ignores a discount that is not lower than the price, and old pay-what-you-want fields", () => {
    expect(orderAmounts({ priceCents: 1900, salePriceCents: 2500 })).toEqual({ subtotalCents: 1900, discountCents: 0, totalCents: 1900 });
    // A product saved before the migration still sells at its old suggested price.
    expect(orderAmounts({ priceCents: 2000, pricingModel: "pwyw", minPriceCents: 500 } as never)).toEqual({ subtotalCents: 2000, discountCents: 0, totalCents: 2000 });
  });
});

describe("validateAnswers", () => {
  const questions: CheckoutQuestionDoc[] = [
    { id: "a", label: "Handle", kind: "text", required: true, options: [] },
    { id: "b", label: "Plan", kind: "dropdown", required: false, options: ["Free", "Pro"] },
    { id: "c", label: "Agree", kind: "checkbox", required: true, options: [] },
    { id: "d", label: "Notes", kind: "long_text", required: false, options: [] },
  ];

  it("accepts good answers, copies labels and ignores unknown ids", () => {
    const result = validateAnswers(questions, { a: "@maya", b: "Pro", c: "true", d: "Hi\nthere", zzz: "ignored" });
    expect(result).toEqual({
      ok: true,
      answers: [
        { questionId: "a", label: "Handle", value: "@maya" },
        { questionId: "b", label: "Plan", value: "Pro" },
        { questionId: "c", label: "Agree", value: "Yes" },
        { questionId: "d", label: "Notes", value: "Hi\nthere" },
      ],
    });
  });

  it("enforces required answers, dropdown choices and text limits on the server", () => {
    expect(validateAnswers(questions, { c: "true" })).toMatchObject({ ok: false, questionId: "a" });
    expect(validateAnswers(questions, { a: "x", c: "false" })).toMatchObject({ ok: false, questionId: "c" });
    expect(validateAnswers(questions, { a: "x", b: "Enterprise", c: "true" })).toMatchObject({ ok: false, questionId: "b" });
    expect(validateAnswers(questions, { a: "x".repeat(301), c: "true" })).toMatchObject({ ok: false, questionId: "a" });
  });

  it("strips HTML from answers", () => {
    const result = validateAnswers(questions, { a: "<script>alert(1)</script>@maya", c: "true" });
    expect(result).toMatchObject({ ok: true, answers: [{ value: "alert(1)@maya" }, expect.anything()] });
  });
});

describe("buyerInput", () => {
  it("normalizes the email and phone and cleans the name", () => {
    expect(buyerInput.parse({ name: " <b>Maya</b> ", email: " Maya@Example.com ", phone: "+1 415 555 2671" })).toMatchObject({
      name: "Maya",
      email: "maya@example.com",
      phone: "+14155552671",
    });
    expect(buyerInput.safeParse({ name: "", email: "maya@example.com", phone: "" }).success).toBe(false);
    expect(buyerInput.safeParse({ name: "Maya", email: "nope", phone: "" }).success).toBe(false);
  });
});

describe("mock provider", () => {
  it("runs only outside production", () => {
    expect(mockAllowed("development")).toBe(true);
    expect(mockAllowed("test")).toBe(true);
    expect(mockAllowed("production")).toBe(false);
  });

  it("rejects an unsigned or tampered webhook", async () => {
    const body = JSON.stringify({ id: "e1", type: "payment.succeeded", orderId: "o1" });
    expect(await mockProvider.handleWebhook(body, null)).toEqual({ ok: false, reason: "bad_signature" });
    expect(await mockProvider.handleWebhook(body, "00".repeat(32))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await mockProvider.handleWebhook(body.replace("o1", "o2"), signMockBody(body))).toEqual({ ok: false, reason: "bad_signature" });
    const signed = await mockProvider.handleWebhook(body, signMockBody(body));
    expect(signed).toMatchObject({ ok: true, event: { eventId: "e1", orderId: "o1" } });
  });
});

describe("handleWebhookRequest (the only way an order becomes paid)", () => {
  const event = (id: string) => {
    const body = JSON.stringify({ id, type: "payment.succeeded", orderId: "order-1" });
    return { body, signature: signMockBody(body) };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.seen.clear();
    hoisted.orders.findOne.mockResolvedValue({ _id: "order-1", totalCents: 1900, currency: "usd", status: "pending" });
    hoisted.orders.updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("marks a pending order paid once; a replay of the same event changes nothing", async () => {
    const { body, signature } = event("evt-1");
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "ok" });
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "duplicate" });
    expect(hoisted.orders.updateOne).toHaveBeenCalledTimes(1);
    expect(hoisted.orders.updateOne).toHaveBeenCalledWith(
      { _id: "order-1", provider: "mock", providerSessionId: "mock_order-1", status: "pending" },
      { $set: { status: "paid", paidAt: expect.any(Date), providerPaymentId: "mockpay_order-1" } },
    );
  });

  it("ignores a payment event whose checkout session is not the one created for the order", async () => {
    const { body, signature } = event("evt-other-session");
    hoisted.orders.findOne.mockResolvedValue(null); // no order with this provider and session id
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "ok" });
    expect(hoisted.orders.findOne).toHaveBeenCalledWith(
      { _id: "order-1", provider: "mock", providerSessionId: "mock_order-1" },
      expect.anything(),
    );
    expect(hoisted.orders.updateOne).not.toHaveBeenCalled();
  });

  it("marks a paid order refunded on a refund event, and only a paid one", async () => {
    const body = JSON.stringify({ id: "evt-refund", type: "payment.refunded", orderId: "order-1" });
    expect(await handleWebhookRequest("mock", body, signMockBody(body))).toEqual({ status: 200, body: "ok" });
    expect(hoisted.orders.findOne).toHaveBeenCalledWith({ providerPaymentId: "mockpay_order-1", provider: "mock" }, expect.anything());
    expect(hoisted.orders.updateOne).toHaveBeenCalledWith(
      { _id: "order-1", status: "paid" },
      { $set: { status: "refunded", refundedAt: expect.any(Date) }, $max: { amountRefundedCents: 1900 } },
    );
  });

  it("refuses a bad signature with 400 and touches nothing", async () => {
    const { body } = event("evt-2");
    expect(await handleWebhookRequest("mock", body, "ab".repeat(32))).toEqual({ status: 400, body: "bad_signature" });
    expect(hoisted.orders.updateOne).not.toHaveBeenCalled();
  });

  it("does not know other providers", async () => {
    expect(await handleWebhookRequest("paypal", "{}", null)).toEqual({ status: 404, body: "not found" });
  });

  it("forgets the event when applying it fails, so the provider's retry is processed", async () => {
    const { body, signature } = event("evt-3");
    hoisted.orders.findOne.mockRejectedValueOnce(new Error("db down"));
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 500, body: "error" });
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "ok" });
  });
});

describe("startCheckout", () => {
  const context = {
    store: { _id: "store-1", slug: "maya", currency: "usd", stripeAccountId: null, stripeChargesEnabled: false },
    open: true,
    product: {
      id: "p1",
      slug: "playbook",
      title: "Playbook",
      priceCents: 1900,
      salePriceCents: null,
      checkout: { headline: null, askPhone: false, questions: [{ id: "q1", label: "Handle", kind: "text", required: true, options: [] }] },
    },
  };
  const provider = { name: "mock", createCheckout: vi.fn() };
  const form = (extra: Record<string, string> = {}) => formData({ name: "Maya", email: "maya@example.com", phone: "", "answer-q1": "@maya", ...extra });

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.takeRateLimit.mockResolvedValue(true);
    hoisted.queries.loadCheckoutContext.mockResolvedValue(context);
    hoisted.queries.canBuy.mockReturnValue(true);
    hoisted.queries.createPendingOrder.mockResolvedValue("order-1");
    hoisted.providerForStore.mockReturnValue(provider);
    provider.createCheckout.mockResolvedValue({ url: "/mock-pay/order-1", providerSessionId: "mock_order-1" });
  });

  it("creates the order from the server-side price and redirects to the provider", async () => {
    const url = await redirectOf(() => startCheckout("maya", "playbook", null, form({ amount: "0.01", price: "1", totalCents: "1" })));
    expect(url).toBe("/mock-pay/order-1");
    expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-1", productId: "p1", subtotalCents: 1900, discountCents: 0, totalCents: 1900, currency: "usd", provider: "mock", buyerEmail: "maya@example.com" }),
    );
    expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1900, orderId: "order-1" }));
    expect(hoisted.queries.attachProviderSession).toHaveBeenCalledWith("order-1", "mock_order-1");
  });

  it("charges the discounted price from the database, whatever amount the form sends (D-047)", async () => {
    hoisted.queries.loadCheckoutContext.mockResolvedValue({ ...context, product: { ...context.product, priceCents: 2900, salePriceCents: 1900 } });
    await redirectOf(() => startCheckout("maya", "playbook", null, form({ amount: "1", salePriceCents: "1" })));
    expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({ item: { title: "Playbook", unitPriceCents: 2900 }, subtotalCents: 2900, discountCents: 1000, totalCents: 1900 }),
    );
    expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1900 }));
  });

  it("takes no order from a paused store, free products included (D-072)", async () => {
    hoisted.queries.loadCheckoutContext.mockResolvedValue({ ...context, open: false });
    expect(await startCheckout("maya", "guide", null, form())).toMatchObject({ ok: false, error: expect.stringMatching(/isn't taking orders/) });
    expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects missing required answers without creating an order", async () => {
    const result = await startCheckout("maya", "playbook", null, form({ "answer-q1": " " }));
    expect(result).toMatchObject({ ok: false, field: "answer-q1" });
    expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
  });

  it("refuses a product that is not published (or unknown)", async () => {
    hoisted.queries.loadCheckoutContext.mockResolvedValue(null);
    expect(await startCheckout("maya", "gone", null, form())).toEqual({ ok: false, error: "This product isn't available anymore." });
    expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
  });

  it("refuses a paid product when the store has no payment provider", async () => {
    hoisted.providerForStore.mockReturnValue(null);
    expect(await startCheckout("maya", "playbook", null, form())).toMatchObject({ ok: false });
    expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
  });

  it("sends a free product straight to the thank-you page through the free path", async () => {
    hoisted.queries.loadCheckoutContext.mockResolvedValue({ ...context, product: { ...context.product, priceCents: 0 } });
    hoisted.providerForStore.mockReturnValue(null);
    const url = await redirectOf(() => startCheckout("maya", "playbook", null, form()));
    expect(url).toBe("/@maya/playbook/thank-you?order=order-1");
    expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ totalCents: 0, provider: "free" }));
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("marks the order failed and hides the error when the provider breaks", async () => {
    provider.createCheckout.mockRejectedValue(new Error("stripe down"));
    const result = await startCheckout("maya", "playbook", null, form());
    expect(JSON.stringify(result)).not.toContain("stripe down");
    expect(hoisted.queries.markOrderFailed).toHaveBeenCalledWith("order-1");
  });

  it("is rate limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await startCheckout("maya", "playbook", null, form())).toMatchObject({ ok: false });
    expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
  });
  describe("an order bump (D-089)", () => {
    const bump = { productId: "b1", title: "Workbook", coverUrl: null, priceCents: 900, headline: null };

    it("adds the bump at the price saved on the product, only when ticked", async () => {
      hoisted.queries.loadCheckoutContext.mockResolvedValue({ ...context, product: { ...context.product, bump: { productId: "b1", priceCents: 900, headline: null } } });
      hoisted.bumps.findCheckoutBump.mockResolvedValueOnce(bump);
      await redirectOf(() => startCheckout("maya", "playbook", null, form({ addBump: "on", bumpPrice: "1" })));
      expect(hoisted.bumps.findCheckoutBump).toHaveBeenCalledWith("store-1", { productId: "b1", priceCents: 900, headline: null });
      expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(
        expect.objectContaining({ item: { title: "Playbook", unitPriceCents: 1900 }, subtotalCents: 2800, discountCents: 0, totalCents: 2800, bump: { productId: "b1", title: "Workbook", priceCents: 900 } }),
      );
      expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 2800, title: "Playbook + Workbook" }));
    });

    it("charges no bump when it is not ticked, or no longer available", async () => {
      await redirectOf(() => startCheckout("maya", "playbook", null, form()));
      expect(hoisted.bumps.findCheckoutBump).not.toHaveBeenCalled();
      hoisted.bumps.findCheckoutBump.mockResolvedValueOnce(null);
      await redirectOf(() => startCheckout("maya", "playbook", null, form({ addBump: "on" })));
      expect(hoisted.queries.createPendingOrder).toHaveBeenLastCalledWith(expect.objectContaining({ totalCents: 1900 }));
      expect(hoisted.queries.createPendingOrder.mock.lastCall?.[0]).not.toHaveProperty("bump");
    });
  });

  describe("a coupon (D-088)", () => {
    const coupon = { _id: "c1", code: "SAVE20", kind: "percent", percentOff: 20, amountOffCents: null, active: true, expiresAt: null, productIds: null, maxRedemptions: null, redemptionCount: 0 };

    it("charges the price minus the coupon, computed from the database, and holds a use", async () => {
      hoisted.coupons.findCouponByCode.mockResolvedValueOnce(coupon);
      expect(await redirectOf(() => startCheckout("maya", "playbook", null, form({ couponCode: "save20", totalCents: "1" })))).toBe("/mock-pay/order-1");
      expect(hoisted.coupons.findCouponByCode).toHaveBeenCalledWith("store-1", "save20");
      expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ subtotalCents: 1900, discountCents: 380, totalCents: 1520, coupon: { couponId: "c1", code: "SAVE20", discountCents: 380 } }));
      expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1520 }));
      expect(hoisted.coupons.holdCoupon).toHaveBeenCalledWith({ storeId: "store-1", couponId: "c1", orderId: "order-1", email: "maya@example.com" });
    });

    it("refuses an unknown, expired or other-product code without an order", async () => {
      expect(await startCheckout("maya", "playbook", null, form({ couponCode: "NOPE" }))).toMatchObject({ ok: false, field: "couponCode" });
      hoisted.coupons.findCouponByCode.mockResolvedValueOnce({ ...coupon, expiresAt: new Date("2000-01-01") });
      expect(await startCheckout("maya", "playbook", null, form({ couponCode: "SAVE20" }))).toMatchObject({ ok: false, error: "This code has expired." });
      hoisted.coupons.findCouponByCode.mockResolvedValueOnce({ ...coupon, productIds: ["other"] });
      expect(await startCheckout("maya", "playbook", null, form({ couponCode: "SAVE20" }))).toMatchObject({ ok: false, field: "couponCode" });
      expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
    });

    it("drops the order when the code was used up or already used by this email", async () => {
      hoisted.coupons.findCouponByCode.mockResolvedValueOnce(coupon);
      hoisted.coupons.holdCoupon.mockResolvedValueOnce("already_used");
      hoisted.queries.markOrderFailed.mockResolvedValueOnce(undefined);
      expect(await startCheckout("maya", "playbook", null, form({ couponCode: "SAVE20" }))).toMatchObject({ ok: false, error: "You have already used this code." });
      expect(hoisted.queries.markOrderFailed).toHaveBeenCalledWith("order-1");
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("sends a 100% coupon through the free path", async () => {
      hoisted.coupons.findCouponByCode.mockResolvedValueOnce({ ...coupon, percentOff: 100 });
      hoisted.providerForStore.mockReturnValue(null);
      expect(await redirectOf(() => startCheckout("maya", "playbook", null, form({ couponCode: "SAVE20" })))).toBe("/@maya/playbook/thank-you?order=order-1");
      expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ totalCents: 0, provider: "free" }));
    });
  });

  describe("a coaching call (D-083)", () => {
    // Mondays 09:00 to 11:00 UTC, 30-minute calls, no notice, booking up to 90 days ahead.
    const coaching = { ...context, product: { ...context.product, type: "coaching", checkout: { headline: null, askPhone: false, questions: [] }, coaching: { durationMinutes: 30, timeZone: "UTC", weekly: [{ day: 1, start: "09:00", end: "11:00" }], bufferMinutes: 0, minNoticeHours: 0, bookingWindowDays: 90 } } };
    const nextMonday = () => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
      date.setUTCHours(10, 0, 0, 0);
      return date;
    };

    beforeEach(() => {
      hoisted.queries.loadCheckoutContext.mockResolvedValue(coaching);
    });

    it("needs a picked time", async () => {
      expect(await startCheckout("maya", "call", null, form())).toMatchObject({ ok: false, field: "slotStart" });
      expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
    });

    it("refuses a time the slot engine does not offer, or one that is busy", async () => {
      const start = nextMonday();
      const offGrid = new Date(start.getTime() + 10 * 60_000).toISOString();
      expect(await startCheckout("maya", "call", null, form({ slotStart: offGrid }))).toMatchObject({ ok: false, field: "slotStart" });
      hoisted.bookings.busyTimesForStore.mockResolvedValueOnce([{ start, end: new Date(start.getTime() + 30 * 60_000) }]);
      expect(await startCheckout("maya", "call", null, form({ slotStart: start.toISOString() }))).toMatchObject({ ok: false, field: "slotStart" });
      expect(hoisted.queries.createPendingOrder).not.toHaveBeenCalled();
    });

    it("saves the server's slot on the order and holds it before the payment page", async () => {
      const start = nextMonday();
      const url = await redirectOf(() => startCheckout("maya", "call", null, form({ slotStart: start.toISOString(), buyerTimeZone: "Asia/Kolkata" })));
      expect(url).toBe("/mock-pay/order-1");
      const booking = { start, end: new Date(start.getTime() + 30 * 60_000), buyerTimeZone: "Asia/Kolkata" };
      expect(hoisted.queries.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({ booking }));
      expect(hoisted.bookings.holdSlot).toHaveBeenCalledWith({ storeId: "store-1", productId: "p1", orderId: "order-1", ...booking });
      expect(hoisted.bookings.busyTimesForStore.mock.calls[0]?.[0]).toBe("store-1");
    });

    it("drops the order when someone else got the time first", async () => {
      hoisted.bookings.holdSlot.mockResolvedValueOnce("taken");
      hoisted.queries.markOrderFailed.mockResolvedValueOnce(undefined);
      expect(await startCheckout("maya", "call", null, form({ slotStart: nextMonday().toISOString() }))).toMatchObject({ ok: false, field: "slotStart" });
      expect(hoisted.queries.markOrderFailed).toHaveBeenCalledWith("order-1");
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("ignores a time zone it does not know", async () => {
      await redirectOf(() => startCheckout("maya", "call", null, form({ slotStart: nextMonday().toISOString(), buyerTimeZone: "<script>" })));
      expect(hoisted.bookings.holdSlot).toHaveBeenCalledWith(expect.objectContaining({ buyerTimeZone: null }));
    });
  });
});

describe("confirmMockPayment", () => {
  it("pays a pending mock order through the webhook path, then shows the thank-you page", async () => {
    vi.clearAllMocks();
    hoisted.seen.clear();
    const id = "11111111-2222-4333-8444-555555555555";
    hoisted.queries.findPendingMockOrder.mockResolvedValue({ id, storeId: "store-1", productId: "p1", title: "Playbook", totalCents: 1900, currency: "usd" });
    hoisted.queries.productPathForOrder.mockResolvedValue({ username: "maya", productSlug: "playbook" });
    hoisted.orders.findOne.mockResolvedValue({ _id: id, totalCents: 1900, currency: "usd", status: "pending" });
    hoisted.orders.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await redirectOf(() => confirmMockPayment(id))).toBe(`/@maya/playbook/thank-you?order=${id}`);
    expect(hoisted.orders.updateOne).toHaveBeenCalledWith({ _id: id, provider: "mock", providerSessionId: `mock_${id}`, status: "pending" }, expect.anything());
  });

  it("ignores ids that are not uuids", async () => {
    expect(await redirectOf(() => confirmMockPayment("../etc"))).toBe("/");
  });
});
