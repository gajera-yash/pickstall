import { beforeEach, describe, expect, it, vi } from "vitest";

// Platform billing with PayPal Subscriptions (D-118): plan names, status mapping, our own app only,
// and the return page saving only this store's subscription.

const hoisted = vi.hoisted(() => ({
  billingOfOwner: vi.fn(),
  applySubscriptionState: vi.fn(async () => "applied"),
  savePlanPayment: vi.fn(async () => true),
  recordAudit: vi.fn(async () => undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { PAYPAL_CLIENT_ID: "P".repeat(30), PAYPAL_CLIENT_SECRET: "Q".repeat(30), PAYPAL_WEBHOOK_ID: "WH-PLATFORM" } }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/plans/billing-queries", () => ({ billingOfOwner: hoisted.billingOfOwner, applySubscriptionState: hoisted.applySubscriptionState }));
vi.mock("@/lib/plans/payments", () => ({ savePlanPayment: hoisted.savePlanPayment }));
vi.mock("@/lib/audit/log", () => ({ recordAudit: hoisted.recordAudit }));

import { createPayPalSubscription, planName, planOfName, stateOfSubscription } from "@/lib/payments/paypal-billing";
import { syncPayPalReturn } from "@/lib/plans/paypal-billing";

const STORE = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const replies: Response[] = [];
const fetchMock = vi.fn(async (url: string) => (url.endsWith("/v1/oauth2/token") ? json({ access_token: "t", expires_in: 32000 }) : (replies.shift() ?? json({ name: "UNEXPECTED" }, 500))));
vi.stubGlobal("fetch", fetchMock);
const calls = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.endsWith("/v1/oauth2/token"));

const base = { id: "I-ABCDEF1234", plan_id: "P-PLAN123456", custom_id: STORE, links: [] };

describe("plan names", () => {
  it("round-trips our plan and price through the PayPal plan name", () => {
    expect(planName("starter", 1900)).toBe("Pickstall Starter monthly 1900 USD");
    expect(planOfName("Pickstall Pro monthly 3900 USD")).toEqual({ plan: "pro", cents: 3900 });
    expect(planOfName("Someone else's plan")).toBeNull();
  });
});

describe("stateOfSubscription", () => {
  const now = new Date("2026-11-21T00:00:00Z");
  const pro = { plan: "pro" as const, cents: 3900 };

  it("maps an active subscription, and one with failed payments as past due", () => {
    const active = stateOfSubscription({ ...base, status: "ACTIVE", billing_info: { next_billing_time: "2026-12-20T10:00:00Z" } }, pro, now);
    expect(active).toMatchObject({ status: "active", plan: "pro", storeId: STORE, customerId: `paypal:${STORE}`, cancelAtPeriodEnd: false, amountCents: 3900, currency: "usd", interval: "month" });
    expect(active.currentPeriodEnd?.toISOString()).toBe("2026-12-20T10:00:00.000Z");
    expect(stateOfSubscription({ ...base, status: "ACTIVE", billing_info: { failed_payments_count: 1 } }, pro, now).status).toBe("past_due");
  });

  it("keeps a cancelled plan active until the paid month ends, then ends it", () => {
    const recent = stateOfSubscription({ ...base, status: "CANCELLED", billing_info: { last_payment: { time: "2026-11-10T00:00:00Z" } } }, pro, now);
    expect(recent).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
    expect(recent.currentPeriodEnd?.toISOString()).toBe("2026-12-10T00:00:00.000Z");
    expect(stateOfSubscription({ ...base, status: "CANCELLED", billing_info: { last_payment: { time: "2026-09-01T00:00:00Z" } } }, pro, now).status).toBe("canceled");
  });

  it("gives no access while pending approval, when suspended or expired", () => {
    expect(stateOfSubscription({ ...base, status: "APPROVAL_PENDING" }, pro, now).status).toBe("incomplete");
    expect(stateOfSubscription({ ...base, status: "SUSPENDED" }, pro, now).status).toBe("unpaid");
    expect(stateOfSubscription({ ...base, status: "EXPIRED" }, pro, now).status).toBe("canceled");
  });
});

describe("subscribing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replies.length = 0;
  });

  it("subscribes on our own app with the store id as custom_id and returns PayPal's approval page", async () => {
    replies.push(
      json({ id: "PICKSTALL-PLANS" }),
      json({ plans: [{ id: "P-STARTER12345", name: "Pickstall Starter monthly 1900 USD", status: "ACTIVE" }], total_pages: 1 }),
      json({ ...base, status: "APPROVAL_PENDING", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1" }] }, 201),
    );
    const url = await createPayPalSubscription({ storeId: STORE, plan: "starter", email: "c@example.com", returnUrl: "https://pickstall.test/api/billing/paypal-return", cancelUrl: "https://pickstall.test/x" });
    expect(url).toBe("https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-1");
    const create = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/billing/subscriptions")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(create[1].body))).toMatchObject({ plan_id: "P-STARTER12345", custom_id: STORE, application_context: { return_url: "https://pickstall.test/api/billing/paypal-return" } });
    expect(calls().every((u) => u.startsWith("https://api-m.sandbox.paypal.com/"))).toBe(true);
  });
});

describe("syncPayPalReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replies.length = 0;
    hoisted.billingOfOwner.mockResolvedValue({ storeId: STORE, customerId: null, subscriptionId: null, status: null });
  });

  it("saves the store's own active subscription", async () => {
    replies.push(json({ ...base, status: "ACTIVE", billing_info: { next_billing_time: "2026-12-20T10:00:00Z" } }), json({ id: "P-PLAN123456", name: "Pickstall Pro monthly 3900 USD" }), json({ transactions: [] }));
    expect(await syncPayPalReturn("owner", "I-ABCDEF1234")).toBe("success");
    expect(hoisted.applySubscriptionState).toHaveBeenCalledWith(expect.objectContaining({ storeId: STORE, plan: "pro", status: "active" }));
  });

  it("never saves another store's subscription, and waits for the webhook without an id", async () => {
    replies.push(json({ ...base, custom_id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" }), json({ id: "P-PLAN123456", name: "Pickstall Pro monthly 3900 USD" }));
    expect(await syncPayPalReturn("owner", "I-ABCDEF1234")).toBe("error");
    expect(hoisted.applySubscriptionState).not.toHaveBeenCalled();
    expect(await syncPayPalReturn("owner", null)).toBe("pending");
    expect(await syncPayPalReturn("owner", "../../v1/x")).toBe("pending");
  });
});
