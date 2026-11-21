import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, OPEN_ACCESS, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

// Settings > Plan with PayPal (D-118): subscribe on the session owner's store, switch with PayPal's
// approval, manage in PayPal, cancel only the store's own subscription.

const paypal = vi.hoisted(() => ({
  paypalBillingConfigured: vi.fn(() => true),
  createPayPalSubscription: vi.fn(async () => "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1"),
  revisePayPalSubscription: vi.fn(async (): Promise<string | null> => "https://www.sandbox.paypal.com/webapps/billing/subscriptions/update?ba_token=BA-2"),
  cancelPayPalSubscription: vi.fn(async () => undefined),
  payPalAutopayUrl: vi.fn(() => "https://www.sandbox.paypal.com/myaccount/autopay/"),
}));
const queries = vi.hoisted(() => ({ billingOfOwner: vi.fn(), applySubscriptionState: vi.fn(async () => "applied") }));
const sync = vi.hoisted(() => ({ syncPayPalSubscription: vi.fn(async () => undefined) }));

vi.mock("@/lib/payments/paypal-billing", () => paypal);
vi.mock("@/lib/plans/billing-queries", () => queries);
vi.mock("@/lib/plans/paypal-billing", () => sync);
vi.mock("@/lib/payments/billing", () => ({ billingConfigured: () => false, createPortalSession: vi.fn(), createSubscriptionCheckout: vi.fn(), switchSubscriptionPlan: vi.fn() }));
vi.mock("@/lib/app-origin", () => ({ appOrigin: vi.fn(async () => "https://pickstall.store") }));
vi.mock("@/lib/payments/paypal-config", async () => ({ ...(await vi.importActual<typeof import("@/lib/payments/paypal-config")>("@/lib/payments/paypal-config")), activeProvider: () => "paypal" }));

import { cancelPlan, openBillingPortal, startSubscription } from "@/lib/plans/actions";

const store = (access: object = OPEN_ACCESS) => ({ id: "store-1", slug: "maya", currency: "usd", access });

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue(store());
  rateLimit.takeRateLimit.mockResolvedValue(true);
  queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: null, subscriptionId: null, status: null });
});

describe("PayPal plans", () => {
  it("subscribes the session owner's own store and goes to PayPal", async () => {
    expect(await redirectOf(() => startSubscription("starter"))).toBe("https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1");
    expect(paypal.createPayPalSubscription).toHaveBeenCalledWith({
      storeId: "store-1",
      plan: "starter",
      email: "maya@example.com",
      returnUrl: "https://pickstall.store/api/billing/paypal-return",
      cancelUrl: "https://pickstall.store/dashboard/settings/plan?billing=cancelled",
    });
  });

  it("switches a running PayPal plan through PayPal's approval, and refuses a Stripe-billed one", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue(store({ ...OPEN_ACCESS, plan: "starter" }));
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "paypal:store-1", subscriptionId: "I-ABCDEF1234", status: "active" });
    expect(await redirectOf(() => startSubscription("pro"))).toBe("https://www.sandbox.paypal.com/webapps/billing/subscriptions/update?ba_token=BA-2");
    expect(paypal.revisePayPalSubscription).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "I-ABCDEF1234", plan: "pro" }));
    expect(await redirectOf(() => startSubscription("starter"))).toBe("/dashboard/settings/plan?billing=same_plan");
    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "cus_1", subscriptionId: "sub_1", status: "active" });
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=provider_changed");
  });

  it("refuses a server without PayPal billing and too many clicks", async () => {
    paypal.paypalBillingConfigured.mockReturnValueOnce(false);
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=unavailable");
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect(await redirectOf(() => startSubscription("pro"))).toBe("/dashboard/settings/plan?billing=slow");
  });

  it("manages billing in PayPal and cancels only the store's own subscription", async () => {
    expect(await redirectOf(() => openBillingPortal())).toBe("/dashboard/settings/plan?billing=no_customer");
    expect(await redirectOf(() => cancelPlan())).toBe("/dashboard/settings/plan?billing=no_customer");
    expect(paypal.cancelPayPalSubscription).not.toHaveBeenCalled();

    queries.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: "paypal:store-1", subscriptionId: "I-ABCDEF1234", status: "active" });
    expect(await redirectOf(() => openBillingPortal())).toBe("https://www.sandbox.paypal.com/myaccount/autopay/");
    expect(await redirectOf(() => cancelPlan())).toBe("/dashboard/settings/plan?billing=plan_cancelled");
    expect(paypal.cancelPayPalSubscription).toHaveBeenCalledWith("I-ABCDEF1234", expect.any(String));
    expect(queries.billingOfOwner).toHaveBeenCalledWith(userId);
  });
});
