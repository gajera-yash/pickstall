// The payment provider interface (CLAUDE.md 7). Everything outside lib/payments/ talks only to this
// shape; provider SDKs and their types never leave this folder.

export type CheckoutInput = {
  orderId: string;
  title: string;
  amountCents: number;
  currency: string;
  buyerEmail: string;
  /** Where the buyer returns after paying. Never used to grant access: only the verified event does. */
  successUrl: string;
  cancelUrl: string;
  /** The creator's own Stripe account id (direct charge, no application fee). */
  connectedAccountId: string | null;
};

export type CheckoutSession = { url: string; providerSessionId: string };

/** A provider event reduced to what fulfilment needs. */
export type PaymentEvent = {
  /** The provider's event id, the idempotency key. */
  eventId: string;
  type: "payment.succeeded" | "payment.refunded";
  /** Our order id. A refund event only knows the provider's payment id, so this can be null there. */
  orderId: string | null;
  providerSessionId: string | null;
  /** The provider's payment id (Stripe PaymentIntent), used to find the order on a refund. */
  providerPaymentId?: string;
  /** What the provider says was paid. When present, fulfilment checks it against our own order total. */
  amountCents?: number;
  currency?: string;
};

export type WebhookOutcome = { ok: true; event: PaymentEvent | null } | { ok: false; reason: "bad_signature" | "bad_payload" };

export type PaymentProvider = {
  readonly name: "stripe" | "mock";
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Verifies the signature and turns the raw request into a normalized event. `event: null` means "valid but not interesting". */
  handleWebhook(rawBody: string, signature: string | null): Promise<WebhookOutcome>;
  refund(input: { providerSessionId: string; connectedAccountId: string | null }): Promise<void>;
};
