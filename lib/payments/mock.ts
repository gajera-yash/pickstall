import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env.server";
import type { CheckoutInput, PaymentEvent, PaymentProvider, WebhookOutcome } from "@/lib/payments/types";

/** The mock exists for development only and refuses to run in production (CLAUDE.md 7). */
export function mockAllowed(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

function guard(): void {
  if (!mockAllowed()) throw new Error("The mock payment provider is disabled in production.");
}

/** HMAC of an event body, so the mock webhook is verified like a real one. */
export function signMockBody(rawBody: string): string {
  return createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(`mock-webhook:${rawBody}`).digest("hex");
}

function validSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signMockBody(rawBody), "hex");
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Development-only provider. It takes no money. `createCheckout` points at our own test payment
 * page; paying there sends a signed event through the same webhook path as Stripe, so an order
 * can only become paid through the real fulfilment code, never by a shortcut.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(input: CheckoutInput) {
    guard();
    return { url: `/mock-pay/${input.orderId}`, providerSessionId: `mock_${input.orderId}` };
  },

  async handleWebhook(rawBody: string, signature: string | null): Promise<WebhookOutcome> {
    guard();
    if (!validSignature(rawBody, signature)) return { ok: false, reason: "bad_signature" };
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "bad_payload" };
    }
    const body = json as Partial<{ id: string; type: string; orderId: string }>;
    if (typeof body.id !== "string" || typeof body.orderId !== "string" || (body.type !== "payment.succeeded" && body.type !== "payment.refunded")) {
      return { ok: false, reason: "bad_payload" };
    }
    const event: PaymentEvent = { eventId: body.id, type: body.type, orderId: body.orderId, providerSessionId: `mock_${body.orderId}`, providerPaymentId: `mockpay_${body.orderId}` };
    return { ok: true, event };
  },

  async refund() {
    guard();
  },
};
