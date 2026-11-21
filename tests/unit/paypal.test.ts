import { beforeEach, describe, expect, it, vi } from "vitest";

// PayPal (D-118): encryption of creators' app secrets, amounts, event normalization, the adapter's
// API calls (fetch mocked) and the webhook path's store binding (creator B's app cannot pay or
// refund creator A's order).

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const KEY = Buffer.alloc(32, 7).toString("base64");

const hoisted = vi.hoisted(() => ({
  apps: new Map<string, { storeId: string; credentials: { mode: "sandbox"; clientId: string; secret: string }; webhookId: string | null }>(),
  orders: { findOne: vi.fn(), updateOne: vi.fn() },
  webhookEvents: { insertOne: vi.fn(async () => undefined), deleteOne: vi.fn(async () => undefined) },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { BETTER_AUTH_SECRET: "x".repeat(40), PAYMENT_CREDENTIALS_KEY: Buffer.alloc(32, 7).toString("base64") } }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/stores/paypal", () => ({ paypalCredentialsOfStore: vi.fn(async (storeId: string) => hoisted.apps.get(storeId) ?? null) }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ orders: hoisted.orders, webhookEvents: hoisted.webhookEvents })) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));
vi.mock("@/lib/payments/stripe", () => ({ stripeConfigured: () => false, stripeProvider: { name: "stripe" } }));
vi.mock("@/lib/stores/queries", () => ({ applyStripeAccountStatus: vi.fn(), detachStripeAccount: vi.fn(), stripeAccountOfStore: vi.fn(async () => null) }));
vi.mock("@/lib/coaching/bookings", () => ({ confirmBookingForOrder: vi.fn(async () => "none"), releaseBookingForOrder: vi.fn() }));
vi.mock("@/lib/coaching/calls", () => ({ cancelBookingOfRefundedOrder: vi.fn() }));
vi.mock("@/lib/coaching/reminders", () => ({ scheduleCallReminders: vi.fn() }));
vi.mock("@/lib/bumps/queries", () => ({ createBumpOrder: vi.fn(async () => null), refundBumpOrder: vi.fn() }));
vi.mock("@/lib/coupons/queries", () => ({ redeemCouponForOrder: vi.fn(), releaseCouponForOrder: vi.fn() }));
vi.mock("@/lib/subscribers/queries", () => ({ addSubscriberForOrder: vi.fn(async () => undefined) }));
vi.mock("@/lib/licenses/queries", () => ({ issueLicenseForOrder: vi.fn(async () => undefined) }));
vi.mock("@/lib/notifications/queries", () => ({ notifyOrderPaid: vi.fn(), notifyRefund: vi.fn() }));
vi.mock("@/lib/orders/confirmation", () => ({ scheduleOrderConfirmation: vi.fn() }));
vi.mock("@/lib/review-request/job", () => ({ scheduleReviewRequest: vi.fn() }));
vi.mock("@/lib/plans/billing-sync", () => ({ syncSubscription: vi.fn(), recordPlanInvoice: vi.fn() }));
vi.mock("@/lib/plans/paypal-billing", () => ({ syncPayPalSubscription: vi.fn(async () => undefined) }));

import { captureIdOfRefund, normalizePayPalEvent, paypalProvider } from "@/lib/payments/paypal";
import { fromPayPalValue, paypalSupportsCurrency, toPayPalValue } from "@/lib/payments/paypal-money";
import { handleWebhookRequest } from "@/lib/payments/process";
import { openSecret, sealSecret } from "@/lib/security/secret-box";

const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const tokenReply = () => json({ access_token: "token", expires_in: 32000 });
// Token calls are answered by themselves (tokens are cached per app); every other call takes the next queued reply.
const replies: Response[] = [];
const fetchMock = vi.fn(async (url: string) => (url.endsWith("/v1/oauth2/token") ? tokenReply() : (replies.shift() ?? json({ name: "UNEXPECTED" }, 500))));
vi.stubGlobal("fetch", fetchMock);
/** The last non-token call. */
const lastCall = () => fetchMock.mock.calls.filter(([url]) => !String(url).endsWith("/v1/oauth2/token")).at(-1) as unknown as [string, RequestInit & { headers: Record<string, string> }];

const signedHeaders = new Headers({
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "tid",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-21T10:00:00Z",
});

describe("secret box", () => {
  it("opens what it sealed, only with the same key and owner", () => {
    const sealed = sealSecret("app-secret", KEY, STORE_A);
    expect(sealed).not.toContain("app-secret");
    expect(openSecret(sealed, KEY, STORE_A)).toBe("app-secret");
    expect(() => openSecret(sealed, KEY, STORE_B)).toThrow();
    expect(() => openSecret(sealed, Buffer.alloc(32, 9).toString("base64"), STORE_A)).toThrow();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => openSecret(parts.join("."), KEY, STORE_A)).toThrow();
  });
});

describe("PayPal amounts", () => {
  it("converts our integer units to PayPal values and back", () => {
    expect(toPayPalValue(1999, "usd")).toBe("19.99");
    expect(toPayPalValue(5, "eur")).toBe("0.05");
    expect(toPayPalValue(500, "jpy")).toBe("500");
    expect(fromPayPalValue("19.99", "USD")).toBe(1999);
    expect(fromPayPalValue("19.9", "usd")).toBe(1990);
    expect(fromPayPalValue("500", "JPY")).toBe(500);
    expect(fromPayPalValue("500.50", "jpy")).toBeNull();
    expect(fromPayPalValue("-1", "usd")).toBeNull();
  });

  it("knows PayPal's currencies, without INR, HUF or TWD", () => {
    expect(paypalSupportsCurrency("USD")).toBe(true);
    expect(paypalSupportsCurrency("inr")).toBe(false);
    expect(paypalSupportsCurrency("huf")).toBe(false);
  });
});

describe("normalizePayPalEvent", () => {
  const capture = { id: "CAP1", status: "COMPLETED", custom_id: ORDER, amount: { currency_code: "USD", value: "19.00" }, supplementary_data: { related_ids: { order_id: "PPORDER1" } } };

  it("maps approval, capture and decline to our events, tied to the store", () => {
    expect(normalizePayPalEvent({ id: "E1", event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "PPORDER1", purchase_units: [{ custom_id: ORDER }] } }, "connect", STORE_A)).toEqual({
      eventId: "E1",
      type: "payment.approved",
      orderId: ORDER,
      providerSessionId: "PPORDER1",
      account: STORE_A,
    });
    expect(normalizePayPalEvent({ id: "E2", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: capture }, "connect", STORE_A)).toEqual({
      eventId: "E2",
      type: "payment.succeeded",
      orderId: ORDER,
      providerSessionId: "PPORDER1",
      providerPaymentId: "CAP1",
      amountCents: 1900,
      currency: "USD",
      account: STORE_A,
    });
    expect(normalizePayPalEvent({ id: "E3", event_type: "PAYMENT.CAPTURE.DECLINED", resource: { ...capture, status: "DECLINED" } }, "connect", STORE_A)).toMatchObject({ type: "payment.failed", orderId: ORDER, providerSessionId: "PPORDER1" });
  });

  it("ignores a capture that is not completed, has no order of ours, or comes to the platform endpoint", () => {
    expect(normalizePayPalEvent({ id: "E", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { ...capture, status: "PENDING" } }, "connect", STORE_A)).toBeNull();
    expect(normalizePayPalEvent({ id: "E", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { ...capture, custom_id: "not-ours" } }, "connect", STORE_A)).toBeNull();
    expect(normalizePayPalEvent({ id: "E", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: capture }, "platform", undefined)).toBeNull();
    expect(normalizePayPalEvent({ id: "E", event_type: "CUSTOMER.DISPUTE.CREATED", resource: {} }, "connect", STORE_A)).toBeNull();
  });

  it("an unreadable amount never matches an order total", () => {
    expect(normalizePayPalEvent({ id: "E", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { ...capture, amount: { currency_code: "USD", value: "abc" } } }, "connect", STORE_A)).toMatchObject({ amountCents: -1 });
  });

  it("maps refunds to the capture, full or partial by the capture's status; a reversal takes all", () => {
    const refund = { id: "REF1", custom_id: ORDER, seller_payable_breakdown: { total_refunded_amount: { currency_code: "USD", value: "5.00" } }, links: [{ rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAP1" }] };
    expect(normalizePayPalEvent({ id: "R1", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: refund }, "connect", STORE_A, { captureStatus: "PARTIALLY_REFUNDED" })).toEqual({
      eventId: "R1",
      type: "payment.refunded",
      orderId: ORDER,
      providerPaymentId: "CAP1",
      amountRefundedCents: 500,
      fullyRefunded: false,
      account: STORE_A,
    });
    expect(normalizePayPalEvent({ id: "R2", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: refund }, "connect", STORE_A, { captureStatus: "REFUNDED" })).toMatchObject({ fullyRefunded: true });
    expect(normalizePayPalEvent({ id: "R3", event_type: "PAYMENT.CAPTURE.REVERSED", resource: refund }, "connect", STORE_A)).toMatchObject({ fullyRefunded: true });
    expect(captureIdOfRefund([{ rel: "up", href: "https://evil.test/v2/payments/captures/../x" }])).toBeNull();
  });

  it("maps plan subscription events only on the platform endpoint", () => {
    expect(normalizePayPalEvent({ id: "S1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-ABC123DEF" } }, "platform", undefined)).toEqual({ eventId: "S1", type: "billing.subscription", subscriptionId: "I-ABC123DEF" });
    expect(normalizePayPalEvent({ id: "S2", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE1", billing_agreement_id: "I-ABC123DEF" } }, "platform", undefined)).toEqual({
      eventId: "S2",
      type: "billing.subscription",
      subscriptionId: "I-ABC123DEF",
      invoiceId: "SALE1",
    });
    expect(normalizePayPalEvent({ id: "S3", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-ABC123DEF" } }, "connect", STORE_A)).toBeNull();
  });
});

describe("PayPal adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replies.length = 0;
    hoisted.apps.clear();
    hoisted.apps.set(STORE_A, { storeId: STORE_A, credentials: { mode: "sandbox", clientId: "A".repeat(30), secret: "S".repeat(30) }, webhookId: "WH-A" });
  });

  const checkout = { orderId: ORDER, title: "Guide", amountCents: 1900, currency: "usd", buyerEmail: "b@example.com", sellerName: "Jetal", successUrl: "https://pickstall.test/ok", cancelUrl: "https://pickstall.test/no", connectedAccountId: STORE_A };

  it("creates the order on the store's own app with our amount, ids and the store's name", async () => {
    replies.push(json({ id: "PPORDER1", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=PPORDER1" }] }, 201));
    expect(await paypalProvider.createCheckout(checkout)).toEqual({ url: "https://www.sandbox.paypal.com/checkoutnow?token=PPORDER1", providerSessionId: "PPORDER1" });
    const [url, init] = lastCall();
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(init.headers["PayPal-Request-Id"]).toBe(`create-${ORDER}`);
    const body = JSON.parse(String(init.body));
    expect(body.purchase_units[0]).toMatchObject({ custom_id: ORDER, invoice_id: ORDER, amount: { currency_code: "USD", value: "19.00" } });
    expect(body.payment_source.paypal.experience_context).toMatchObject({ brand_name: "Jetal", shipping_preference: "NO_SHIPPING", return_url: checkout.successUrl });
    // No platform fee and no other payee: the money goes to the app's own account.
    expect(body.purchase_units[0].payee).toBeUndefined();
    expect(body.purchase_units[0].payment_instruction).toBeUndefined();
  });

  it("refuses an approval link that is not on paypal.com, an unsupported currency, and a store without PayPal", async () => {
    replies.push(json({ id: "PPORDER2", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://paypal.com.evil.test/x" }] }, 201));
    await expect(paypalProvider.createCheckout({ ...checkout, orderId: "44444444-4444-4444-8444-444444444444" })).rejects.toThrow();
    await expect(paypalProvider.createCheckout({ ...checkout, currency: "inr" })).rejects.toThrow();
    await expect(paypalProvider.createCheckout({ ...checkout, connectedAccountId: STORE_B })).rejects.toThrow();
  });

  it("captures and refunds idempotently on the store's app", async () => {
    replies.push(json({ id: "PPORDER1", status: "COMPLETED", links: [] }, 201));
    await paypalProvider.completeCheckout?.({ orderId: ORDER, providerSessionId: "PPORDER1", connectedAccountId: STORE_A });
    let [url, init] = lastCall();
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/PPORDER1/capture");
    expect(init.headers["PayPal-Request-Id"]).toBe(`capture-${ORDER}`);

    replies.push(json({ id: "REF1", status: "COMPLETED" }, 201));
    await paypalProvider.refund({ orderId: ORDER, providerPaymentId: "CAP1", amountCents: 1900, connectedAccountId: STORE_A });
    [url, init] = lastCall();
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/payments/captures/CAP1/refund");
    expect(JSON.parse(String(init.body))).toEqual({ custom_id: ORDER });
    await expect(paypalProvider.refund({ orderId: ORDER, providerPaymentId: "../x", amountCents: 1, connectedAccountId: STORE_A })).rejects.toThrow();
  });
});

describe("PayPal webhooks through the shared pipeline", () => {
  const capture = (orderId: string) =>
    JSON.stringify({
      id: `WH-EVENT-${orderId.slice(0, 4)}`,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAP1", status: "COMPLETED", custom_id: orderId, amount: { currency_code: "USD", value: "19.00" }, supplementary_data: { related_ids: { order_id: "PPORDER1" } } },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    replies.length = 0;
    hoisted.apps.clear();
    hoisted.apps.set(STORE_A, { storeId: STORE_A, credentials: { mode: "sandbox", clientId: "A".repeat(30), secret: "S".repeat(30) }, webhookId: "WH-A" });
    hoisted.apps.set(STORE_B, { storeId: STORE_B, credentials: { mode: "sandbox", clientId: "B".repeat(30), secret: "T".repeat(30) }, webhookId: "WH-B" });
    hoisted.orders.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  });

  it("marks the order paid when the store's own app sent it", async () => {
    hoisted.orders.findOne.mockResolvedValue({ _id: ORDER, storeId: STORE_A, totalCents: 1900, currency: "usd" });
    replies.push(json({ verification_status: "SUCCESS" }));
    expect(await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: signedHeaders, accountId: STORE_A })).toEqual({ status: 200, body: "ok" });
    const verifyBody = JSON.parse(String(lastCall()[1].body));
    expect(verifyBody).toMatchObject({ webhook_id: "WH-A", transmission_id: "tid" });
    expect(hoisted.orders.updateOne).toHaveBeenCalledWith(
      { _id: ORDER, provider: "paypal", providerSessionId: "PPORDER1", status: "pending" },
      { $set: { status: "paid", paidAt: expect.any(Date), providerPaymentId: "CAP1" } },
    );
  });

  it("never lets creator B's app pay creator A's order", async () => {
    hoisted.orders.findOne.mockResolvedValue({ _id: ORDER, storeId: STORE_A, totalCents: 1900, currency: "usd" });
    replies.push(json({ verification_status: "SUCCESS" }));
    expect(await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: signedHeaders, accountId: STORE_B })).toEqual({ status: 200, body: "ok" });
    expect(hoisted.orders.updateOne).not.toHaveBeenCalled();
  });

  it("refuses a delivery PayPal does not verify, and one for a store without a webhook", async () => {
    replies.push(json({ verification_status: "FAILURE" }));
    expect(await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: signedHeaders, accountId: STORE_A })).toEqual({ status: 400, body: "bad_signature" });
    hoisted.apps.set(STORE_A, { ...hoisted.apps.get(STORE_A)!, webhookId: null });
    expect(await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: signedHeaders, accountId: STORE_A })).toEqual({ status: 400, body: "bad_signature" });
    expect(await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: new Headers(), accountId: STORE_B })).toEqual({ status: 400, body: "bad_signature" });
    expect(hoisted.orders.updateOne).not.toHaveBeenCalled();
  });

  it("never marks paid for a different amount", async () => {
    hoisted.orders.findOne.mockResolvedValue({ _id: ORDER, storeId: STORE_A, totalCents: 2900, currency: "usd" });
    replies.push(json({ verification_status: "SUCCESS" }));
    await handleWebhookRequest("paypal", capture(ORDER), null, "connect", { headers: signedHeaders, accountId: STORE_A });
    expect(hoisted.orders.updateOne).not.toHaveBeenCalled();
  });
});
