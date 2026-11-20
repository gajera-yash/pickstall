import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// The Stripe adapter's webhook side (D-053): signature checks with separate secrets, test/live mode,
// which account an event belongs to, and how Stripe events map to our events. No network.

const env = vi.hoisted(() => ({
  serverEnv: {
    STRIPE_SECRET_KEY: "sk_test_unit",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect_unit",
    STRIPE_PLATFORM_WEBHOOK_SECRET: "whsec_platform_unit",
    STRIPE_PLATFORM_ACCOUNT_ID: "acct_platform" as string | undefined,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => env);
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { normalizeStripeEvent, stripeProvider } from "@/lib/payments/stripe";
import { liveKey } from "@/lib/payments/test-account";

type StripeEvent = Parameters<typeof normalizeStripeEvent>[0];

function stripeEvent(type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}): StripeEvent {
  return { id: `evt_${type}`, object: "event", type, livemode: false, account: "acct_creator", data: { object }, ...extra } as unknown as StripeEvent;
}

/** Stripe's documented signature scheme: `t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<payload>">`. */
function sign(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

const session = {
  id: "cs_test_1",
  object: "checkout.session",
  metadata: { order_id: "order-1" },
  client_reference_id: "order-1",
  payment_status: "paid",
  payment_intent: "pi_1",
  amount_total: 1900,
  currency: "usd",
};

describe("Stripe webhook signatures", () => {
  const body = JSON.stringify(stripeEvent("checkout.session.completed", session));

  it("accepts the Connect secret on the Connect endpoint", async () => {
    const outcome = await stripeProvider.handleWebhook(body, sign(body, "whsec_connect_unit"), "connect");
    expect(outcome).toMatchObject({ ok: true, event: { type: "payment.succeeded", orderId: "order-1" } });
  });

  it("refuses a missing, wrong or other endpoint's signature, and a tampered body", async () => {
    expect(await stripeProvider.handleWebhook(body, null, "connect")).toEqual({ ok: false, reason: "bad_signature" });
    expect(await stripeProvider.handleWebhook(body, sign(body, "whsec_wrong"), "connect")).toEqual({ ok: false, reason: "bad_signature" });
    // Separate secrets (CLAUDE.md 7): the platform secret does not open the Connect endpoint, and back.
    expect(await stripeProvider.handleWebhook(body, sign(body, "whsec_platform_unit"), "connect")).toEqual({ ok: false, reason: "bad_signature" });
    expect(await stripeProvider.handleWebhook(body, sign(body, "whsec_connect_unit"), "platform")).toEqual({ ok: false, reason: "bad_signature" });
    const tampered = body.replace("1900", "1");
    expect(await stripeProvider.handleWebhook(tampered, sign(body, "whsec_connect_unit"), "connect")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses an old signature (replay outside Stripe's tolerance)", async () => {
    const old = Math.floor(Date.now() / 1000) - 60 * 60;
    expect(await stripeProvider.handleWebhook(body, sign(body, "whsec_connect_unit", old), "connect")).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("normalizeStripeEvent", () => {
  it("maps a paid checkout to payment.succeeded with Stripe's amount and the connected account", () => {
    expect(normalizeStripeEvent(stripeEvent("checkout.session.completed", session), "connect")).toEqual({
      eventId: "evt_checkout.session.completed",
      type: "payment.succeeded",
      account: "acct_creator",
      orderId: "order-1",
      providerSessionId: "cs_test_1",
      providerPaymentId: "pi_1",
      amountCents: 1900,
      currency: "usd",
    });
  });

  it("waits for a delayed payment method, then fulfils on async_payment_succeeded", () => {
    expect(normalizeStripeEvent(stripeEvent("checkout.session.completed", { ...session, payment_status: "unpaid" }), "connect")).toBeNull();
    expect(normalizeStripeEvent(stripeEvent("checkout.session.async_payment_succeeded", session), "connect")).toMatchObject({ type: "payment.succeeded" });
  });

  it("maps a failed delayed payment and an expired checkout to payment.failed", () => {
    for (const type of ["checkout.session.async_payment_failed", "checkout.session.expired"]) {
      expect(normalizeStripeEvent(stripeEvent(type, { ...session, payment_status: "unpaid" }), "connect")).toMatchObject({ type: "payment.failed", orderId: "order-1", providerSessionId: "cs_test_1" });
    }
  });

  it("maps full and partial refunds", () => {
    const charge = { id: "ch_1", object: "charge", payment_intent: "pi_1", amount_refunded: 500, refunded: false, metadata: { order_id: "order-1" } };
    expect(normalizeStripeEvent(stripeEvent("charge.refunded", charge), "connect")).toMatchObject({ type: "payment.refunded", providerPaymentId: "pi_1", amountRefundedCents: 500, fullyRefunded: false });
    expect(normalizeStripeEvent(stripeEvent("charge.refunded", { ...charge, amount_refunded: 1900, refunded: true }), "connect")).toMatchObject({ fullyRefunded: true });
  });

  it("maps account status and deauthorization, on the Connect endpoint only", () => {
    const account = { id: "acct_creator", object: "account", charges_enabled: true, payouts_enabled: false, details_submitted: true };
    expect(normalizeStripeEvent(stripeEvent("account.updated", account), "connect")).toEqual({
      eventId: "evt_account.updated",
      type: "account.updated",
      account: "acct_creator",
      status: { chargesEnabled: true, payoutsEnabled: false, detailsSubmitted: true },
    });
    expect(normalizeStripeEvent(stripeEvent("account.application.deauthorized", { id: "ca_1", object: "application" }), "connect")).toEqual({
      eventId: "evt_account.application.deauthorized",
      type: "account.deauthorized",
      account: "acct_creator",
    });
    expect(normalizeStripeEvent(stripeEvent("account.updated", account, { account: undefined }), "platform")).toBeNull();
  });

  it("ignores events of the other mode (a live event with a test key)", () => {
    expect(liveKey()).toBe(false);
    expect(normalizeStripeEvent(stripeEvent("checkout.session.completed", session, { livemode: true }), "connect")).toBeNull();
  });

  it("ignores a Connect event without an account; on the platform endpoint the account is our own", () => {
    expect(normalizeStripeEvent(stripeEvent("checkout.session.completed", session, { account: undefined }), "connect")).toBeNull();
    expect(normalizeStripeEvent(stripeEvent("checkout.session.completed", session, { account: undefined }), "platform")).toMatchObject({ account: "acct_platform" });
  });

  it("ignores unrelated events", () => {
    expect(normalizeStripeEvent(stripeEvent("customer.created", { id: "cus_1" }), "connect")).toBeNull();
  });
});

describe("platform billing events (D-073)", () => {
  const platform = (type: string, object: Record<string, unknown>) => normalizeStripeEvent(stripeEvent(type, object, { account: undefined }), "platform");

  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"])(
    "turns %s on the platform endpoint into a billing event",
    (type) => {
      expect(platform(type, { id: "sub_1", object: "subscription" })).toEqual({ eventId: `evt_${type}`, type: "billing.subscription", subscriptionId: "sub_1" });
    },
  );

  it("finds the subscription of a paid or failed invoice", () => {
    const invoice = { id: "in_1", object: "invoice", parent: { type: "subscription_details", subscription_details: { subscription: "sub_2" } } };
    // A paid invoice is also saved for the admin's revenue (D-116); a failed one is not.
    expect(platform("invoice.paid", invoice)).toMatchObject({ type: "billing.subscription", subscriptionId: "sub_2", invoiceId: "in_1" });
    expect(platform("invoice.payment_failed", invoice)).not.toHaveProperty("invoiceId");
  });

  it("treats a finished subscription Checkout as billing, and a payment Checkout still as an order", () => {
    expect(platform("checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "subscription", subscription: "sub_3" })).toMatchObject({
      type: "billing.subscription",
      subscriptionId: "sub_3",
    });
    expect(platform("checkout.session.completed", { ...session, mode: "payment" })).toMatchObject({ type: "payment.succeeded", orderId: "order-1" });
  });

  it("never takes billing events from the Connect endpoint (creators' accounts)", () => {
    expect(normalizeStripeEvent(stripeEvent("customer.subscription.updated", { id: "sub_1", object: "subscription" }), "connect")).toBeNull();
  });

  it("works without the test seller account id set", () => {
    env.serverEnv.STRIPE_PLATFORM_ACCOUNT_ID = undefined;
    try {
      expect(platform("customer.subscription.updated", { id: "sub_9", object: "subscription" })).toMatchObject({ subscriptionId: "sub_9" });
    } finally {
      env.serverEnv.STRIPE_PLATFORM_ACCOUNT_ID = "acct_platform";
    }
  });
});

describe("liveKey", () => {
  it("is true only for live secret or restricted keys", () => {
    expect(liveKey("sk_live_x")).toBe(true);
    expect(liveKey("rk_live_x")).toBe(true);
    expect(liveKey("sk_test_x")).toBe(false);
    expect(liveKey(undefined)).toBe(false);
  });
});
