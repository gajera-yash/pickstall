import "server-only";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { PayPalApiError, paypalCall, type PayPalCredentials } from "@/lib/payments/paypal-api";
import { platformPayPal } from "@/lib/payments/paypal-config";
import { fromPayPalValue, paypalSupportsCurrency, toPayPalValue } from "@/lib/payments/paypal-money";
import type { CheckoutInput, PaymentEvent, PaymentProvider, RefundInput, WebhookContext, WebhookEndpoint, WebhookOutcome } from "@/lib/payments/types";
import { paypalCredentialsOfStore } from "@/lib/stores/paypal";

// PayPal adapter (D-118). Each creator's OWN PayPal REST app creates the order, so the buyer pays
// the creator directly: Pickstall never holds the money and takes no fee (CLAUDE.md 7 in spirit).
// Prices come from our database. The buyer approves on PayPal, then the order is captured (on the
// return page, on the CHECKOUT.ORDER.APPROVED webhook, or by the pending sweep; idempotent with
// PayPal-Request-Id). Only the verified PAYMENT.CAPTURE.COMPLETED webhook marks the order paid.

/** PayPal order and capture ids: upper-case letters and digits (OpenAPI: ^[A-Z0-9]+$, up to 36). */
const PAYPAL_ID = /^[A-Z0-9]{1,36}$/;

/** Events the creator's app must send to /api/webhooks/paypal/<storeId>. */
export const CREATOR_WEBHOOK_EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DECLINED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
] as const;

const link = z.object({ href: z.string(), rel: z.string() }).loose();
const money = z.object({ currency_code: z.string(), value: z.string() }).loose();
const orderResponse = z.object({ id: z.string().regex(PAYPAL_ID), status: z.string(), links: z.array(link).default([]) }).loose();
const captureResponse = z.object({ id: z.string().regex(PAYPAL_ID), status: z.string() }).loose();
const webhookResponse = z.object({ id: z.string().min(1), url: z.string() }).loose();
const webhookList = z.object({ webhooks: z.array(webhookResponse).default([]) }).loose();
const verifyResponse = z.object({ verification_status: z.enum(["SUCCESS", "FAILURE"]) });

const envelope = z.object({ id: z.string().min(1).max(200), event_type: z.string().min(1).max(100), resource: z.unknown() }).loose();
const orderResource = z.object({ id: z.string().regex(PAYPAL_ID), purchase_units: z.array(z.object({ custom_id: z.string().optional() }).loose()).min(1) }).loose();
const captureResource = z
  .object({
    id: z.string().regex(PAYPAL_ID),
    status: z.string(),
    custom_id: z.string().optional(),
    amount: money.optional(),
    supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().optional() }).loose().optional() }).loose().optional(),
  })
  .loose();
const refundResource = z
  .object({
    id: z.string().min(1),
    custom_id: z.string().optional(),
    seller_payable_breakdown: z.object({ total_refunded_amount: money.optional() }).loose().optional(),
    links: z.array(link).default([]),
  })
  .loose();
const subscriptionResource = z.object({ id: z.string().regex(/^I-[A-Z0-9]{6,40}$/) }).loose();
const saleResource = z.object({ id: z.string().min(1).max(64), billing_agreement_id: z.string().optional() }).loose();

function approvalUrl(links: z.infer<typeof link>[]): string | null {
  // "payer-action" when payment_source.paypal.experience_context is used; "approve" in older flows.
  const found = links.find((item) => item.rel === "payer-action") ?? links.find((item) => item.rel === "approve");
  if (!found) return null;
  try {
    const url = new URL(found.href);
    return url.protocol === "https:" && /(^|\.)paypal\.com$/.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/** The capture id a refund belongs to, from its "up" link (GET /v2/payments/captures/{id}). */
export function captureIdOfRefund(links: { href: string; rel: string }[]): string | null {
  const up = links.find((item) => item.rel === "up");
  const match = up ? /\/v2\/payments\/captures\/([A-Z0-9]{1,36})$/.exec(up.href) : null;
  return match?.[1] ?? null;
}

async function storeApp(storeId: string | null): Promise<{ credentials: PayPalCredentials; webhookId: string | null }> {
  if (!storeId || !isUuid(storeId)) throw new Error("No store for this PayPal call.");
  const app = await paypalCredentialsOfStore(storeId);
  if (!app) throw new Error("PayPal is not connected for this store.");
  return app;
}

const orderIdOf = (value: string | undefined) => (value && isUuid(value) ? value : null);

/**
 * Turns a verified PayPal event into our normalized event, or null when it does not concern us.
 * `captureStatus` is the capture's status fetched from PayPal for a refund event (full or partial).
 * Exported for unit tests; webhooks go through `handleWebhook`.
 */
export function normalizePayPalEvent(
  event: z.infer<typeof envelope>,
  endpoint: WebhookEndpoint,
  accountId: string | undefined,
  extra: { captureStatus?: string; currency?: string } = {},
): PaymentEvent | null {
  const eventId = event.id;
  if (endpoint === "platform") {
    // Platform billing (D-118): the creator's subscription to a Pickstall plan, on OUR app only.
    if (event.event_type.startsWith("BILLING.SUBSCRIPTION.")) {
      const sub = subscriptionResource.safeParse(event.resource);
      return sub.success ? { eventId, type: "billing.subscription", subscriptionId: sub.data.id } : null;
    }
    if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      const sale = saleResource.safeParse(event.resource);
      const subscriptionId = sale.success ? sale.data.billing_agreement_id : undefined;
      if (!sale.success || !subscriptionId || !/^I-[A-Z0-9]{6,40}$/.test(subscriptionId)) return null;
      return { eventId, type: "billing.subscription", subscriptionId, invoiceId: sale.data.id };
    }
    return null;
  }

  // Creators' sales: always tied to the store whose app sent (and verified) the event.
  const account = accountId ?? null;
  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED": {
      const order = orderResource.safeParse(event.resource);
      const orderId = order.success ? orderIdOf(order.data.purchase_units[0]?.custom_id) : null;
      return order.success && orderId ? { eventId, type: "payment.approved", orderId, providerSessionId: order.data.id, account } : null;
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const capture = captureResource.safeParse(event.resource);
      if (!capture.success || capture.data.status !== "COMPLETED") return null;
      const orderId = orderIdOf(capture.data.custom_id);
      const paypalOrderId = capture.data.supplementary_data?.related_ids?.order_id;
      if (!orderId || !paypalOrderId) return null;
      const amount = capture.data.amount;
      return {
        eventId,
        type: "payment.succeeded",
        orderId,
        providerSessionId: paypalOrderId,
        providerPaymentId: capture.data.id,
        // An amount we cannot read never matches an order total (-1), so the order is not marked paid.
        amountCents: amount ? (fromPayPalValue(amount.value, amount.currency_code) ?? -1) : -1,
        currency: amount?.currency_code ?? "",
        account,
      };
    }
    case "PAYMENT.CAPTURE.DECLINED":
    case "PAYMENT.CAPTURE.DENIED": {
      const capture = captureResource.safeParse(event.resource);
      const paypalOrderId = capture.success ? capture.data.supplementary_data?.related_ids?.order_id : undefined;
      if (!capture.success || !paypalOrderId) return null;
      return { eventId, type: "payment.failed", orderId: orderIdOf(capture.data.custom_id), providerSessionId: paypalOrderId, account };
    }
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED": {
      const refund = refundResource.safeParse(event.resource);
      if (!refund.success) return null;
      const captureId = captureIdOfRefund(refund.data.links);
      if (!captureId) return null;
      const total = refund.data.seller_payable_breakdown?.total_refunded_amount;
      const refunded = total ? fromPayPalValue(total.value, total.currency_code) : null;
      return {
        eventId,
        type: "payment.refunded",
        orderId: orderIdOf(refund.data.custom_id),
        providerPaymentId: captureId,
        ...(refunded !== null ? { amountRefundedCents: refunded } : {}),
        // A reversal (chargeback) takes all of it; otherwise the capture's own status says.
        fullyRefunded: event.event_type === "PAYMENT.CAPTURE.REVERSED" || extra.captureStatus === "REFUNDED",
        account,
      };
    }
    default:
      return null;
  }
}

function header(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.length <= 4096 ? value : null;
}

/** Asks PayPal whether this webhook delivery is genuine, for the app and webhook it was sent to. */
async function verifyDelivery(credentials: PayPalCredentials, webhookId: string, headers: Headers, event: unknown): Promise<boolean> {
  const body = {
    auth_algo: header(headers, "paypal-auth-algo"),
    cert_url: header(headers, "paypal-cert-url"),
    transmission_id: header(headers, "paypal-transmission-id"),
    transmission_sig: header(headers, "paypal-transmission-sig"),
    transmission_time: header(headers, "paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  };
  if (Object.values(body).some((value) => value === null)) return false;
  const result = await paypalCall(credentials, "/v1/notifications/verify-webhook-signature", { method: "POST", body }, verifyResponse);
  return result.verification_status === "SUCCESS";
}

export const paypalProvider: PaymentProvider = {
  name: "paypal",

  async createCheckout(input: CheckoutInput) {
    if (!paypalSupportsCurrency(input.currency)) throw new Error("PayPal does not take this currency.");
    const { credentials } = await storeApp(input.connectedAccountId);
    const order = await paypalCall(
      credentials,
      "/v2/checkout/orders",
      {
        method: "POST",
        requestId: `create-${input.orderId}`,
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.orderId,
              custom_id: input.orderId,
              // Unique per merchant by default, so one order can never be paid twice.
              invoice_id: input.orderId,
              description: input.title.slice(0, 127),
              amount: { currency_code: input.currency.toUpperCase(), value: toPayPalValue(input.amountCents, input.currency) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                ...(input.sellerName ? { brand_name: input.sellerName.slice(0, 127) } : {}),
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                return_url: input.successUrl,
                cancel_url: input.cancelUrl,
              },
            },
          },
        },
      },
      orderResponse,
    );
    const url = approvalUrl(order.links);
    if (!url) throw new Error("PayPal did not return an approval link.");
    return { url, providerSessionId: order.id };
  },

  async completeCheckout(input) {
    if (!PAYPAL_ID.test(input.providerSessionId)) throw new Error("Not a PayPal order id.");
    const { credentials } = await storeApp(input.connectedAccountId);
    await paypalCall(credentials, `/v2/checkout/orders/${input.providerSessionId}/capture`, { method: "POST", body: {}, requestId: `capture-${input.orderId}` }, orderResponse);
  },

  async checkoutStatus(input) {
    if (!PAYPAL_ID.test(input.providerSessionId)) return "gone";
    const { credentials } = await storeApp(input.connectedAccountId);
    try {
      const order = await paypalCall(credentials, `/v2/checkout/orders/${input.providerSessionId}`, { method: "GET" }, orderResponse);
      // Order statuses (OpenAPI order_status): CREATED, SAVED, APPROVED, VOIDED, COMPLETED, PAYER_ACTION_REQUIRED.
      if (order.status === "APPROVED") return "approved";
      if (order.status === "COMPLETED") return "completed";
      if (order.status === "VOIDED") return "gone";
      return "open";
    } catch (error) {
      if (error instanceof PayPalApiError && error.status === 404) return "gone"; // expired orders are no longer found
      throw error;
    }
  },

  async handleWebhook(rawBody: string, _signature: string | null, endpoint: WebhookEndpoint = "connect", context?: WebhookContext): Promise<WebhookOutcome> {
    if (!context?.headers) return { ok: false, reason: "bad_signature" };
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "bad_payload" };
    }
    const event = envelope.safeParse(json);
    if (!event.success) return { ok: false, reason: "bad_payload" };

    // The app (and the webhook id we registered on it) the delivery must come from.
    let app: { credentials: PayPalCredentials; webhookId: string | null } | null;
    if (endpoint === "platform") {
      const platform = platformPayPal();
      app = platform ? { credentials: { mode: platform.mode, clientId: platform.clientId, secret: platform.secret }, webhookId: platform.webhookId } : null;
    } else {
      app = context.accountId && isUuid(context.accountId) ? await paypalCredentialsOfStore(context.accountId) : null;
    }
    if (!app?.webhookId) return { ok: false, reason: "bad_signature" };

    try {
      if (!(await verifyDelivery(app.credentials, app.webhookId, context.headers, json))) return { ok: false, reason: "bad_signature" };
    } catch (error) {
      logger.warn("paypal.webhook_verify_failed", { status: error instanceof PayPalApiError ? error.status : undefined });
      return { ok: false, reason: "bad_signature" };
    }

    // A refund: the capture's own status tells a full refund from a partial one.
    let captureStatus: string | undefined;
    if (endpoint === "connect" && event.data.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const refund = refundResource.safeParse(event.data.resource);
      const captureId = refund.success ? captureIdOfRefund(refund.data.links) : null;
      if (captureId) captureStatus = (await paypalCall(app.credentials, `/v2/payments/captures/${captureId}`, { method: "GET" }, captureResponse)).status;
    }

    return { ok: true, event: normalizePayPalEvent(event.data, endpoint, context.accountId, { captureStatus }) };
  },

  /** Full refund of the capture, on the creator's own app. The order changes on the verified refund event. */
  async refund(input: RefundInput) {
    if (!PAYPAL_ID.test(input.providerPaymentId)) throw new Error("Not a PayPal capture id.");
    const { credentials } = await storeApp(input.connectedAccountId);
    // No amount: PayPal refunds the whole capture. custom_id lets the refund event name our order.
    await paypalCall(credentials, `/v2/payments/captures/${input.providerPaymentId}/refund`, { method: "POST", body: { custom_id: input.orderId }, requestId: `refund-${input.orderId}` }, z.object({ id: z.string() }).loose());
  },
};

/** Checks a creator's app works (the token call succeeds). Throws PayPalApiError otherwise. */
export async function checkPayPalApp(credentials: PayPalCredentials): Promise<void> {
  await paypalCall(credentials, "/v1/notifications/webhooks", { method: "GET" }, webhookList);
}

/** Registers our webhook on the creator's app (or reuses one already pointing at `url`) and returns its id. */
export async function ensurePayPalWebhook(credentials: PayPalCredentials, url: string, events: readonly string[] = CREATOR_WEBHOOK_EVENTS): Promise<string> {
  const existing = await paypalCall(credentials, "/v1/notifications/webhooks", { method: "GET" }, webhookList);
  const same = existing.webhooks.find((hook) => hook.url === url);
  if (same) return same.id;
  const created = await paypalCall(credentials, "/v1/notifications/webhooks", { method: "POST", body: { url, event_types: events.map((name) => ({ name })) } }, webhookResponse);
  return created.id;
}

/** Removes our webhook from the creator's app (best effort when they disconnect). */
export async function deletePayPalWebhook(credentials: PayPalCredentials, webhookId: string): Promise<void> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(webhookId)) return;
  await paypalCall(credentials, `/v1/notifications/webhooks/${webhookId}`, { method: "DELETE" }, z.object({}).loose());
}
