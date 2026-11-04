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

/** A connected seller account's state, as the provider reports it. */
export type AccountStatus = { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };

/**
 * The seller account an event came from. `undefined` means the provider has no accounts (the mock),
 * so there is nothing to compare; otherwise it must equal the order's store account.
 */
type FromAccount = { account?: string | null };

/** A provider event reduced to what fulfilment needs. `eventId` is the provider's event id, the idempotency key. */
export type PaymentEvent =
  | (FromAccount & {
      eventId: string;
      type: "payment.succeeded";
      orderId: string;
      /** Must be the session we created for this order (R9). */
      providerSessionId: string;
      /** The provider's payment id (Stripe PaymentIntent), used to find the order on a refund. */
      providerPaymentId?: string;
      /** What the provider says was paid. When present, fulfilment checks it against our own order total. */
      amountCents?: number;
      currency?: string;
    })
  | (FromAccount & {
      eventId: string;
      /** The payment did not complete (delayed method failed, or the checkout expired). Only a pending order changes. */
      type: "payment.failed";
      orderId: string | null;
      providerSessionId: string;
    })
  | (FromAccount & {
      eventId: string;
      type: "payment.refunded";
      /** A refund event only knows the provider's payment id, so this can be null. */
      orderId: string | null;
      providerPaymentId?: string;
      /** Total refunded so far, in Stripe amount units. Missing means "all of it". */
      amountRefundedCents?: number;
      /** True when the whole payment is refunded: access ends. A partial refund keeps access. */
      fullyRefunded: boolean;
    })
  | { eventId: string; type: "account.updated"; account: string; status: AccountStatus }
  | { eventId: string; type: "account.deauthorized"; account: string };

export type WebhookOutcome = { ok: true; event: PaymentEvent | null } | { ok: false; reason: "bad_signature" | "bad_payload" };

/** Which of our webhook endpoints a request arrived on. Each has its own signing secret (CLAUDE.md 7). */
export type WebhookEndpoint = "connect" | "platform";

export type RefundInput = { orderId: string; providerPaymentId: string; amountCents: number; connectedAccountId: string | null };

export type PaymentProvider = {
  readonly name: "stripe" | "mock";
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Verifies the signature and turns the raw request into a normalized event. `event: null` means "valid but not interesting". */
  handleWebhook(rawBody: string, signature: string | null, endpoint?: WebhookEndpoint): Promise<WebhookOutcome>;
  /**
   * Asks the provider to refund the whole payment. It does NOT change the order: the provider's
   * verified refund event does that, through the same path as every other event.
   */
  refund(input: RefundInput): Promise<void>;
};
