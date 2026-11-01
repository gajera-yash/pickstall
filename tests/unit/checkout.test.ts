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
vi.mock("@/lib/payments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments");
  return { ...actual, providerForStore: hoisted.providerForStore };
});
vi.mock("@/lib/payments/stripe", () => ({ stripeConfigured: () => false, stripeProvider: { name: "stripe" } }));

import type { CheckoutQuestionDoc } from "@/lib/db/collections";
import { validateAnswers } from "@/lib/orders/answers";
import { startCheckout, confirmMockPayment } from "@/lib/orders/actions";
import { computeAmountCents } from "@/lib/orders/pricing";
import { buyerInput } from "@/lib/orders/schemas";
import { mockAllowed, mockProvider, signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

const fixed = { pricingModel: "fixed", priceCents: 1900, minPriceCents: null } as const;
const pwyw = { pricingModel: "pwyw", priceCents: 2000, minPriceCents: 500 } as const;

describe("computeAmountCents", () => {
  it("charges the product's fixed price whatever the client sends", () => {
    expect(computeAmountCents(fixed, "0.01")).toEqual({ ok: true, cents: 1900 });
    expect(computeAmountCents(fixed, undefined)).toEqual({ ok: true, cents: 1900 });
  });

  it("checks a pay-what-you-want amount against the minimum and the maximum", () => {
    expect(computeAmountCents(pwyw, "")).toEqual({ ok: true, cents: 2000 });
    expect(computeAmountCents(pwyw, "5")).toEqual({ ok: true, cents: 500 });
    expect(computeAmountCents(pwyw, "12.50")).toEqual({ ok: true, cents: 1250 });
    expect(computeAmountCents(pwyw, "4.99")).toMatchObject({ ok: false });
    expect(computeAmountCents(pwyw, "0")).toMatchObject({ ok: false });
    expect(computeAmountCents(pwyw, "500.01")).toMatchObject({ ok: false });
    expect(computeAmountCents(pwyw, "abc")).toMatchObject({ ok: false });
    expect(computeAmountCents(pwyw, "-5")).toMatchObject({ ok: false });
    expect(computeAmountCents({ ...pwyw, minPriceCents: 0 }, "0.5")).toMatchObject({ ok: false });
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
    expect(hoisted.orders.updateOne).toHaveBeenCalledWith({ _id: "order-1", provider: "mock", status: "paid" }, { $set: { status: "refunded" } });
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
    product: {
      id: "p1",
      slug: "playbook",
      title: "Playbook",
      pricingModel: "fixed",
      priceCents: 1900,
      minPriceCents: null,
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
      expect.objectContaining({ storeId: "store-1", productId: "p1", totalCents: 1900, currency: "usd", provider: "mock", buyerEmail: "maya@example.com" }),
    );
    expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1900, orderId: "order-1" }));
    expect(hoisted.queries.attachProviderSession).toHaveBeenCalledWith("order-1", "mock_order-1");
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
