import { beforeEach, describe, expect, it, vi } from "vitest";

// Back from Stripe Checkout (D-073): only a well-formed Checkout id of THIS store's subscription is
// saved; anything else is refused without calling Stripe for someone else's data.

const mocks = vi.hoisted(() => ({
  subscriptionOfCheckout: vi.fn(),
  fetchSubscriptionState: vi.fn(),
  billingOfOwner: vi.fn(),
  applySubscriptionState: vi.fn(async () => "applied"),
  recordAudit: vi.fn(async () => undefined),
  fetchPlanInvoice: vi.fn(),
  listPaidPlanInvoices: vi.fn(),
  savePlanPayment: vi.fn(async () => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/payments/billing", () => ({
  subscriptionOfCheckout: mocks.subscriptionOfCheckout,
  fetchSubscriptionState: mocks.fetchSubscriptionState,
  fetchPlanInvoice: mocks.fetchPlanInvoice,
  listPaidPlanInvoices: mocks.listPaidPlanInvoices,
}));
vi.mock("@/lib/plans/payments", () => ({ savePlanPayment: mocks.savePlanPayment }));
vi.mock("@/lib/audit/log", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/plans/billing-queries", () => ({ billingOfOwner: mocks.billingOfOwner, applySubscriptionState: mocks.applySubscriptionState }));

import { importPlanInvoices, recordPlanInvoice, syncCheckoutReturn, syncSubscription } from "@/lib/plans/billing-sync";

const active = { subscriptionId: "sub_1", customerId: "cus_1", storeId: "store-1", plan: "pro", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.billingOfOwner.mockResolvedValue({ storeId: "store-1", customerId: null, subscriptionId: null, status: null });
});

describe("syncCheckoutReturn", () => {
  it("refuses a missing or malformed session id before calling Stripe", async () => {
    for (const bad of [null, "", "cs_live", "pi_123", "cs_test_<script>", "x".repeat(300)]) expect(await syncCheckoutReturn("owner-1", bad)).toBe("error");
    expect(mocks.subscriptionOfCheckout).not.toHaveBeenCalled();
  });

  it("checks the Checkout against the owner's own store and saves an active subscription", async () => {
    mocks.subscriptionOfCheckout.mockResolvedValue(active);
    expect(await syncCheckoutReturn("owner-1", "cs_test_a1B2c3D4e5F6g7")).toBe("success");
    expect(mocks.subscriptionOfCheckout).toHaveBeenCalledWith("cs_test_a1B2c3D4e5F6g7", "store-1");
    expect(mocks.applySubscriptionState).toHaveBeenCalledWith(active);
  });

  it("does nothing for a Checkout of another store", async () => {
    mocks.subscriptionOfCheckout.mockResolvedValue(null);
    expect(await syncCheckoutReturn("owner-1", "cs_test_a1B2c3D4e5F6g7")).toBe("error");
    expect(mocks.applySubscriptionState).not.toHaveBeenCalled();
  });

  it("says pending while the first payment is still processing, and on Stripe errors", async () => {
    mocks.subscriptionOfCheckout.mockResolvedValueOnce({ ...active, status: "incomplete" });
    expect(await syncCheckoutReturn("owner-1", "cs_test_a1B2c3D4e5F6g7")).toBe("pending");
    mocks.subscriptionOfCheckout.mockRejectedValueOnce(new Error("stripe down"));
    expect(await syncCheckoutReturn("owner-1", "cs_test_a1B2c3D4e5F6g7")).toBe("pending");
  });
});

describe("syncSubscription", () => {
  it("saves what Stripe says now, not what the event said", async () => {
    mocks.fetchSubscriptionState.mockResolvedValue(active);
    await syncSubscription("sub_1");
    expect(mocks.fetchSubscriptionState).toHaveBeenCalledWith("sub_1");
    expect(mocks.applySubscriptionState).toHaveBeenCalledWith(active);
  });
});

describe("plan invoices (D-116)", () => {
  const invoice = { invoiceId: "in_1", customerId: "cus_1", subscriptionId: "sub_1", storeId: "store-1", plan: "pro", amountPaidCents: 4900, currency: "usd", paidAt: new Date() };

  it("saves a paid invoice fetched from Stripe, and skips anything that is not one", async () => {
    mocks.fetchPlanInvoice.mockResolvedValueOnce(invoice);
    await recordPlanInvoice("in_1");
    expect(mocks.fetchPlanInvoice).toHaveBeenCalledWith("in_1");
    expect(mocks.savePlanPayment).toHaveBeenCalledWith(invoice);
    mocks.savePlanPayment.mockClear();
    mocks.fetchPlanInvoice.mockResolvedValueOnce(null);
    await recordPlanInvoice("in_2");
    expect(mocks.savePlanPayment).not.toHaveBeenCalled();
  });

  it("imports past invoices and counts only the new ones", async () => {
    mocks.listPaidPlanInvoices.mockResolvedValueOnce([invoice, { ...invoice, invoiceId: "in_2" }]);
    mocks.savePlanPayment.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await importPlanInvoices()).toEqual({ seen: 2, added: 1 });
  });
});
