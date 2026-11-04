import { createHmac, randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Block D (D-053) on a real MongoDB: signed Stripe events through the real webhook handler, the
// Connect OAuth state, account status, deauthorization and refunds. Stripe's API is never called:
// the OAuth code exchange is replaced, and refunds go through the mock provider's event path.

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_integration";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_connect_integration";
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET = "whsec_platform_integration";
  process.env.STRIPE_CONNECT_CLIENT_ID = "ca_integration";
  process.env.STRIPE_PLATFORM_ACCOUNT_ID = "acct_platform";
});

const sent = vi.hoisted(() => ({ emails: [] as string[] }));
const connect = vi.hoisted(() => ({
  exchangeConnectCode: vi.fn(),
  deauthorizeAccount: vi.fn(async () => undefined),
}));
const session = vi.hoisted(() => ({ ownerId: "", storeId: "" }));

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async (email: { to: string }) => void sent.emails.push(email.to)) }));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/payments/connect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/connect")>("@/lib/payments/connect");
  return { ...actual, ...connect };
});
// The refund action's session: whichever store the test sets.
vi.mock("@/lib/auth/guards", () => ({
  requireCreator: vi.fn(async () => ({ user: { id: session.ownerId, email: "c@example.com" }, store: { id: session.storeId } })),
}));

import { collections, type OrderDoc, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { findOrderDetail, findRefundableOrder, markRefundRequested } from "@/lib/orders/creator-queries";
import { refundOrder } from "@/lib/orders/refund-actions";
import { handleWebhookRequest } from "@/lib/payments/process";
import { completeStripeConnect, consumeConnectState, createConnectState } from "@/lib/stores/stripe-connect";
import { setStoreStripeConnection } from "@/lib/stores/queries";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

async function notificationsOf(storeId: string) {
  const { notifications } = await collections();
  return notifications.find({ storeId }).toArray();
}

const CONNECT_SECRET = "whsec_connect_integration";
const PLATFORM_SECRET = "whsec_platform_integration";

function sign(payload: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
}

function stripeEvent(type: string, object: Record<string, unknown>, account: string | undefined, id = `evt_${randomUUID()}`) {
  return JSON.stringify({ id, object: "event", type, livemode: false, ...(account ? { account } : {}), data: { object } });
}

function deliver(body: string, endpoint: "connect" | "platform" = "connect") {
  return handleWebhookRequest("stripe", body, sign(body, endpoint === "connect" ? CONNECT_SECRET : PLATFORM_SECRET), endpoint);
}

function checkoutObject(order: OrderDoc, overrides: Record<string, unknown> = {}) {
  return {
    id: order.providerSessionId,
    object: "checkout.session",
    metadata: { order_id: order._id },
    client_reference_id: order._id,
    payment_status: "paid",
    payment_intent: `pi_${order._id.slice(0, 8)}`,
    amount_total: order.totalCents,
    currency: order.currency,
    ...overrides,
  };
}

async function order(id: string): Promise<OrderDoc | null> {
  return (await collections()).orders.findOne({ _id: id });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

async function sellerStore(accountId: string, overrides: Partial<StoreDoc> = {}) {
  const store = await seedStore({ stripeAccountId: accountId, stripeChargesEnabled: true, ...overrides });
  const product = await seedProduct(store._id);
  return { store, product };
}

const pendingStripe = (product: ProductDoc, overrides: Partial<OrderDoc> = {}) =>
  seedOrder(product, { status: "pending", paidAt: null, provider: "stripe", providerSessionId: `cs_test_${randomUUID()}`, ...overrides });

beforeEach(() => {
  sent.emails.length = 0;
  vi.clearAllMocks();
});

describe("Connect webhook: paying an order", () => {
  it("marks the order paid exactly once, even when Stripe delivers the event twice", async () => {
    const { product } = await sellerStore("acct_maya");
    const o = await pendingStripe(product);
    const body = stripeEvent("checkout.session.completed", checkoutObject(o), "acct_maya");

    expect(await deliver(body)).toEqual({ status: 200, body: "ok" });
    expect(await deliver(body)).toEqual({ status: 200, body: "duplicate" });
    await settle();

    const paid = await order(o._id);
    expect(paid?.status).toBe("paid");
    expect(paid?.providerPaymentId).toBe(`pi_${o._id.slice(0, 8)}`);
    expect(sent.emails).toHaveLength(1);
    // One "New sale" for the creator, however often Stripe delivers (D-061).
    const notes = await notificationsOf(o.storeId);
    expect(notes.filter((note) => note.kind === "sale")).toHaveLength(1);
    expect(notes[0]).toMatchObject({ dedupeKey: `sale:${o._id}`, href: `/dashboard/orders?order=${o._id}`, readAt: null });
  });

  it("rejects a bad signature with 400 and leaves the order pending", async () => {
    const { product } = await sellerStore("acct_bad_sig");
    const o = await pendingStripe(product);
    const body = stripeEvent("checkout.session.completed", checkoutObject(o), "acct_bad_sig");
    expect(await handleWebhookRequest("stripe", body, sign(body, "whsec_attacker"), "connect")).toEqual({ status: 400, body: "bad_signature" });
    expect(await handleWebhookRequest("stripe", body, sign(body, PLATFORM_SECRET), "connect")).toEqual({ status: 400, body: "bad_signature" });
    expect((await order(o._id))?.status).toBe("pending");
  });

  it("ignores an event from ANOTHER creator's Stripe account that names this store's order", async () => {
    const { product } = await sellerStore("acct_victim");
    await sellerStore("acct_attacker");
    const o = await pendingStripe(product);
    expect(await deliver(stripeEvent("checkout.session.completed", checkoutObject(o), "acct_attacker"))).toEqual({ status: 200, body: "ok" });
    expect((await order(o._id))?.status).toBe("pending");
  });

  it("never marks paid for a different amount or currency than our own order (no client-trusted amounts)", async () => {
    const { product } = await sellerStore("acct_amounts");
    const cheap = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(cheap, { amount_total: 1 }), "acct_amounts"));
    expect((await order(cheap._id))?.status).toBe("pending");
    const otherCurrency = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(otherCurrency, { currency: "inr" }), "acct_amounts"));
    expect((await order(otherCurrency._id))?.status).toBe("pending");
  });

  it("handles zero-decimal currencies in Stripe's own units", async () => {
    const { product } = await sellerStore("acct_jpy", { currency: "jpy" });
    const o = await pendingStripe(product, { currency: "jpy", totalCents: 500, subtotalCents: 500 });
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(o, { amount_total: 500, currency: "jpy" }), "acct_jpy"));
    expect((await order(o._id))?.status).toBe("paid");
  });

  it("waits for a delayed payment, and an expired checkout fails the order for good", async () => {
    const { product } = await sellerStore("acct_async");
    const o = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(o, { payment_status: "unpaid" }), "acct_async"));
    expect((await order(o._id))?.status).toBe("pending");
    await deliver(stripeEvent("checkout.session.async_payment_succeeded", checkoutObject(o), "acct_async"));
    expect((await order(o._id))?.status).toBe("paid");

    const expired = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.expired", checkoutObject(expired, { payment_status: "unpaid" }), "acct_async"));
    expect((await order(expired._id))?.status).toBe("failed");
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(expired), "acct_async"));
    expect((await order(expired._id))?.status).toBe("failed");
  });

  it("an expired-session event never fails an order that is already paid", async () => {
    const { product } = await sellerStore("acct_late");
    const o = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(o), "acct_late"));
    await deliver(stripeEvent("checkout.session.expired", checkoutObject(o), "acct_late"));
    expect((await order(o._id))?.status).toBe("paid");
  });

  it("the platform endpoint pays orders of the test seller account (our own account) only", async () => {
    const { product } = await sellerStore("acct_platform");
    const o = await pendingStripe(product);
    expect(await deliver(stripeEvent("checkout.session.completed", checkoutObject(o), undefined), "platform")).toEqual({ status: 200, body: "ok" });
    expect((await order(o._id))?.status).toBe("paid");

    const { product: other } = await sellerStore("acct_someone");
    const o2 = await pendingStripe(other);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(o2), undefined), "platform");
    expect((await order(o2._id))?.status).toBe("pending");
  });
});

describe("Connect webhook: refunds", () => {
  async function paidOrder(account: string) {
    const { store, product } = await sellerStore(account);
    const o = await pendingStripe(product);
    await deliver(stripeEvent("checkout.session.completed", checkoutObject(o), account));
    return { store, o: (await order(o._id)) as OrderDoc };
  }

  it("a partial refund keeps access; a full refund marks the order refunded", async () => {
    const { o } = await paidOrder("acct_refunds");
    const charge = { id: "ch_1", object: "charge", payment_intent: o.providerPaymentId, amount_refunded: 500, refunded: false, metadata: {} };
    await deliver(stripeEvent("charge.refunded", charge, "acct_refunds"));
    expect(await order(o._id)).toMatchObject({ status: "paid", amountRefundedCents: 500 });

    await deliver(stripeEvent("charge.refunded", { ...charge, amount_refunded: o.totalCents, refunded: true }, "acct_refunds"));
    expect(await order(o._id)).toMatchObject({ status: "refunded", amountRefundedCents: o.totalCents });
    // A partial and a full refund: two notifications; another delivery of the same refund adds none.
    await deliver(stripeEvent("charge.refunded", { ...charge, amount_refunded: o.totalCents, refunded: true }, "acct_refunds"));
    const refunds = (await notificationsOf(o.storeId)).filter((note) => note.kind === "refund");
    expect(refunds.map((note) => note.title).sort()).toHaveLength(2);
  });

  it("ignores a refund event from another account", async () => {
    const { o } = await paidOrder("acct_refund_victim");
    const charge = { id: "ch_2", object: "charge", payment_intent: o.providerPaymentId, amount_refunded: o.totalCents, refunded: true, metadata: {} };
    await deliver(stripeEvent("charge.refunded", charge, "acct_refund_attacker"));
    expect((await order(o._id))?.status).toBe("paid");
  });
});

describe("Connect webhook: account status and deauthorization", () => {
  it("keeps the store's Stripe status fresh", async () => {
    const { store } = await sellerStore("acct_status");
    await deliver(stripeEvent("account.updated", { id: "acct_status", object: "account", charges_enabled: false, payouts_enabled: false, details_submitted: true }, "acct_status"));
    const doc = await (await collections()).stores.findOne({ _id: store._id });
    expect(doc).toMatchObject({ stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeDetailsSubmitted: true });
  });

  it("deauthorization disconnects the store and unpublishes its paid products only", async () => {
    const { store, product: paid } = await sellerStore("acct_leaving");
    const free = await seedProduct(store._id, { priceCents: 0 });
    const { store: other, product: otherPaid } = await sellerStore("acct_staying");
    await deliver(stripeEvent("account.application.deauthorized", { id: "ca_x", object: "application" }, "acct_leaving"));

    const { stores, products } = await collections();
    expect(await stores.findOne({ _id: store._id })).toMatchObject({ stripeAccountId: null, stripeChargesEnabled: false });
    expect((await products.findOne({ _id: paid._id }))?.status).toBe("draft");
    expect((await products.findOne({ _id: free._id }))?.status).toBe("published");
    expect((await stores.findOne({ _id: other._id }))?.stripeAccountId).toBe("acct_staying");
    expect((await products.findOne({ _id: otherPaid._id }))?.status).toBe("published");
  });
});

describe("Connect OAuth state and callback", () => {
  const account = { accountId: "acct_new", livemode: false, status: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true } };

  it("a state works once, only for the user who created it, only before it expires", async () => {
    const owner = randomUUID();
    const state = await createConnectState(owner, "setup");
    expect(await consumeConnectState(state, randomUUID())).toBeNull(); // another user
    expect(await consumeConnectState(state, owner)).toBe("setup");
    expect(await consumeConnectState(state, owner)).toBeNull(); // used up

    const old = await createConnectState(owner, "settings", new Date(Date.now() - 11 * 60_000));
    expect(await consumeConnectState(old, owner)).toBeNull();
  });

  it("saves the account on the user's own store and never exchanges a code twice", async () => {
    const store = await seedStore();
    connect.exchangeConnectCode.mockResolvedValue({ ok: true, account });
    const state = await createConnectState(store.ownerId, "settings");

    expect(await completeStripeConnect(store.ownerId, { state, code: "ac_123" })).toBe("/dashboard/settings/payments?stripe=connected");
    expect(await completeStripeConnect(store.ownerId, { state, code: "ac_123" })).toBe("/dashboard/settings/payments?stripe=expired");
    expect(connect.exchangeConnectCode).toHaveBeenCalledTimes(1);
    expect(await (await collections()).stores.findOne({ _id: store._id })).toMatchObject({ stripeAccountId: "acct_new", stripeChargesEnabled: true, stripeLivemode: false });
  });

  it("someone else's callback link cannot connect their account to my store", async () => {
    const attacker = await seedStore();
    const victim = await seedStore();
    const attackerState = await createConnectState(attacker.ownerId, "settings");
    expect(await completeStripeConnect(victim.ownerId, { state: attackerState, code: "ac_attacker" })).toContain("stripe=expired");
    expect(connect.exchangeConnectCode).not.toHaveBeenCalled();
    expect((await (await collections()).stores.findOne({ _id: victim._id }))?.stripeAccountId).toBeNull();
  });

  it("reports a cancel, a wrong mode and a bad query without connecting", async () => {
    const store = await seedStore();
    const cancelled = await createConnectState(store.ownerId, "setup");
    expect(await completeStripeConnect(store.ownerId, { state: cancelled, error: "access_denied" })).toBe("/dashboard/setup?stripe=cancelled");
    connect.exchangeConnectCode.mockResolvedValue({ ok: false, reason: "wrong_mode" });
    const wrong = await createConnectState(store.ownerId, "settings");
    expect(await completeStripeConnect(store.ownerId, { state: wrong, code: "ac_live" })).toContain("stripe=wrong_mode");
    expect(await completeStripeConnect(store.ownerId, { state: "x" })).toContain("stripe=expired");
    expect((await (await collections()).stores.findOne({ _id: store._id }))?.stripeAccountId).toBeNull();
  });

  it("disconnecting unpublishes paid products and changes only the owner's store", async () => {
    const { store, product } = await sellerStore("acct_disconnect");
    const { store: other, product: otherProduct } = await sellerStore("acct_other_disconnect");
    expect(await setStoreStripeConnection(store.ownerId, null)).toEqual({ previousAccountId: "acct_disconnect" });
    const { stores, products } = await collections();
    expect((await stores.findOne({ _id: store._id }))?.stripeAccountId).toBeNull();
    expect((await products.findOne({ _id: product._id }))?.status).toBe("draft");
    expect((await stores.findOne({ _id: other._id }))?.stripeAccountId).toBe("acct_other_disconnect");
    expect((await products.findOne({ _id: otherProduct._id }))?.status).toBe("published");
  });
});

describe("refund button (cross-tenant and the one refund path)", () => {
  it("creator B cannot see, refund or mark creator A's order", async () => {
    const a = await seedStore();
    const b = await seedStore();
    const productA = await seedProduct(a._id);
    const orderA = await seedOrder(productA, { providerPaymentId: `mockpay_${randomUUID()}` });

    expect(await findRefundableOrder(b._id, orderA._id)).toBeNull();
    await markRefundRequested(b._id, orderA._id);
    expect((await order(orderA._id))?.refundRequestedAt).toBeUndefined();

    session.ownerId = b.ownerId;
    session.storeId = b._id;
    expect(await refundOrder(orderA._id)).toMatchObject({ ok: false });
    expect((await order(orderA._id))?.status).toBe("paid");
  });

  it("refunds the creator's own paid order through the verified event path", async () => {
    const store = await seedStore();
    const product = await seedProduct(store._id);
    const o = await seedOrder(product);
    // The mock's payment id, as its succeeded event saves it.
    await (await collections()).orders.updateOne({ _id: o._id }, { $set: { providerPaymentId: `mockpay_${o._id}` } });

    session.ownerId = store.ownerId;
    session.storeId = store._id;
    expect(await refundOrder(o._id)).toEqual({ ok: true, data: { requested: true } });
    const refunded = await order(o._id);
    expect(refunded).toMatchObject({ status: "refunded" });
    expect(refunded?.refundRequestedAt).toBeInstanceOf(Date);
    expect(await findOrderDetail(store._id, o._id)).toMatchObject({ refundable: false, status: "refunded" });
    expect(await refundOrder(o._id)).toMatchObject({ ok: false }); // already refunded
  });

  it("free orders and unpaid orders cannot be refunded", async () => {
    const store = await seedStore();
    const product = await seedProduct(store._id, { priceCents: 0 });
    const free = await seedOrder(product, { provider: "free", totalCents: 0 });
    const pendingOrder = await seedOrder(product, { status: "pending", providerPaymentId: `mockpay_${randomUUID()}` });
    expect(await findRefundableOrder(store._id, free._id)).toBeNull();
    expect(await findRefundableOrder(store._id, pendingOrder._id)).toBeNull();
  });
});
