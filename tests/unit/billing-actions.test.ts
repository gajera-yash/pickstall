import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, OPEN_ACCESS, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

// Settings > Plan buttons (D-073): validation, rate limit, subscribe vs switch, and the portal. Stripe
// and the database are mocked; the real Stripe calls live in lib/payments/billing.ts.

const billing = vi.hoisted(() => ({
  billingConfigured: vi.fn(() => true),
  createSubscriptionCheckout: vi.fn(async () => "https://checkout.stripe.com/c/pay/cs_test_1"),
  createPortalSession: vi.fn(async () => "https://billing.stripe.com/p/session/test_1"),
  switchSubscriptionPlan: vi.fn(async () => ({ subscriptionId: "sub_1", customerId: "cus_1", storeId: "store-1", plan: "pro", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false })),
}));
const queries = vi.hoisted(() => ({
  billingOfOwner: vi.fn(),
  applySubscriptionState: vi.fn(async () => "applied"),
}));

vi.mock("@/lib/payments/billing", () => billing);
vi.mock("@/lib/plans/billing-queries", () => queries);
vi.mock("@/lib/app-origin", () => ({ appOrigin: vi.fn(async () => "https://pickstall.store") }));
// These tests cover the dormant Stripe Billing path (PAYMENT_PROVIDER=stripe, D-118); PayPal billing has its own tests.
vi.mock("@/lib/payments/paypal-config", async () => ({ ...(await vi.importActual<typeof import("@/lib/payments/paypal-config")>("@/lib/payments/paypal-config")), activeProvider: () => "stripe" }));

import { openBillingPortal, startSubscription } from "@/lib/plans/actions";

const store = (access: object = OPEN_ACCESS) => ({ id: "store-1", slug: "maya", currency: "usd", access });

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue(store());
  rateLimit.takeRateLimit.mockResolvedValue(true);
  billing.billingConfigured.mockReturnValue(true);
  queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: null, subscriptionId: null, status: null });
});

describe("startSubscription", () => {
  it("sends the creator to Stripe Checkout for their own store, with the return route", async () => {
    expect(await redirectOf(() => startSubscription("starter"))).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith({
      storeId: "store-1",
      plan: "starter",
      email: "maya@example.com",
      customerId: null,
      successUrl: "https://pickstall.store/api/billing/return?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://pickstall.store/dashboard/settings/plan?billing=cancelled",
    });
  });

  it("reuses the Stripe customer from an earlier subscription", async () => {
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "cus_1", subscriptionId: "sub_old", status: "canceled" });
    await redirectOf(() => startSubscription("pro"));
    expect(billing.createSubscriptionCheckout).toHaveBeenCalledWith(expect.objectContaining({ customerId: "cus_1", plan: "pro" }));
  });

  it("refuses unknown plans, a server without billing, and too many clicks", async () => {
    expect(await redirectOf(() => startSubscription("platinum"))).toBe("/dashboard/settings/plan?billing=error");
    billing.billingConfigured.mockReturnValueOnce(false);
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=unavailable");
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=slow");
    expect(billing.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("switches plan in place when a paid plan is running, and saves Stripe's answer", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue(store({ ...OPEN_ACCESS, state: "active", plan: "starter" }));
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "cus_1", subscriptionId: "sub_1", status: "active" });
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=switched");
    expect(billing.switchSubscriptionPlan).toHaveBeenCalledWith("sub_1", "pro");
    expect(queries.applySubscriptionState).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub_1", plan: "pro" }));
    expect(billing.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("does nothing for the plan the creator already has", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue(store({ ...OPEN_ACCESS, state: "active", plan: "pro" }));
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "cus_1", subscriptionId: "sub_1", status: "active" });
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=same_plan");
    expect(billing.switchSubscriptionPlan).not.toHaveBeenCalled();
  });

  it("hides Stripe errors behind a generic outcome", async () => {
    billing.createSubscriptionCheckout.mockRejectedValueOnce(new Error("stripe down"));
    expect(await redirectOf(() => startSubscription("starter"))).toBe("/dashboard/settings/plan?billing=error");
  });
});

describe("openBillingPortal", () => {
  it("opens Stripe's portal for the store's own customer", async () => {
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "cus_1", subscriptionId: "sub_1", status: "active" });
    expect(await redirectOf(() => openBillingPortal())).toBe("https://billing.stripe.com/p/session/test_1");
    expect(billing.createPortalSession).toHaveBeenCalledWith("cus_1", "https://pickstall.store/dashboard/settings/plan");
  });

  it("explains that billing settings appear after the first payment", async () => {
    expect(await redirectOf(() => openBillingPortal())).toBe("/dashboard/settings/plan?billing=no_customer");
    expect(billing.createPortalSession).not.toHaveBeenCalled();
  });
});
