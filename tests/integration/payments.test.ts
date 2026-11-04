import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The order pipeline on a real MongoDB (CLAUDE.md 7 and 10): a replayed or parallel webhook gives one
// paid order and one email; an event for another checkout session or amount changes nothing.

const sent = vi.hoisted(() => ({ emails: [] as { to: string; subject: string }[] }));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string }) => {
    sent.emails.push({ to: email.to, subject: email.subject });
  }),
}));
// `after()` needs a request scope; run the scheduled work straight away instead.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});

import { collections, type OrderDoc, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest, markFreeOrderPaid } from "@/lib/payments/process";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

let store: StoreDoc;
let product: ProductDoc;

beforeAll(async () => {
  store = await seedStore();
  product = await seedProduct(store._id);
});

beforeEach(() => {
  sent.emails.length = 0;
});

const pending = (overrides: Partial<OrderDoc> = {}) => seedOrder(product, { status: "pending", paidAt: null, ...overrides });

function mockEvent(orderId: string, type: "payment.succeeded" | "payment.refunded" = "payment.succeeded", id = `evt_${randomUUID()}`) {
  const body = JSON.stringify({ id, type, orderId });
  return { body, signature: signMockBody(body) };
}

async function order(id: string): Promise<OrderDoc | null> {
  const { orders } = await collections();
  return orders.findOne({ _id: id });
}

/** Lets the work scheduled with `after()` finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

describe("webhook idempotency", () => {
  it("the same event twice gives one paid order, one processed event and one email", async () => {
    const { _id } = await pending();
    const { body, signature } = mockEvent(_id);

    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "ok" });
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "duplicate" });
    await settle();

    expect((await order(_id))?.status).toBe("paid");
    const { webhookEvents, emailOutbox } = await collections();
    expect(await webhookEvents.countDocuments({ orderId: _id })).toBe(1);
    expect(await emailOutbox.countDocuments({ orderId: _id })).toBe(1);
    expect(sent.emails).toHaveLength(1);
  });

  it("ten parallel deliveries of one event still process it once", async () => {
    const { _id } = await pending();
    const { body, signature } = mockEvent(_id);
    const results = await Promise.all(Array.from({ length: 10 }, () => handleWebhookRequest("mock", body, signature)));
    await settle();

    expect(results.filter((r) => r.body === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.body === "duplicate")).toHaveLength(9);
    expect(sent.emails).toHaveLength(1);
  });

  it("two different events for the same order send one email", async () => {
    const { _id } = await pending();
    const first = mockEvent(_id);
    const second = mockEvent(_id);
    await Promise.all([handleWebhookRequest("mock", first.body, first.signature), handleWebhookRequest("mock", second.body, second.signature)]);
    await settle();
    expect((await order(_id))?.status).toBe("paid");
    expect(sent.emails).toHaveLength(1);
  });

  it("calling the confirmation directly again does not email twice", async () => {
    const { _id } = await seedOrder(product);
    const results = await Promise.all([sendOrderConfirmation(_id), sendOrderConfirmation(_id), sendOrderConfirmation(_id)]);
    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(sent.emails).toHaveLength(1);
  });
});

describe("an event only pays its own order", () => {
  it("ignores an event whose checkout session is not the order's", async () => {
    const { _id } = await pending({ providerSessionId: "mock_some-other-session" });
    const { body, signature } = mockEvent(_id);
    expect(await handleWebhookRequest("mock", body, signature)).toEqual({ status: 200, body: "ok" });
    expect((await order(_id))?.status).toBe("pending");
  });

  it("ignores a mock event for a Stripe order", async () => {
    const { _id } = await pending({ provider: "stripe", providerSessionId: `mock_placeholder` });
    const { orders } = await collections();
    await orders.updateOne({ _id }, { $set: { providerSessionId: `mock_${_id}` } });
    const { body, signature } = mockEvent(_id);
    await handleWebhookRequest("mock", body, signature);
    expect((await order(_id))?.status).toBe("pending");
  });

  it("refuses a forged signature", async () => {
    const { _id } = await pending();
    const { body } = mockEvent(_id);
    expect(await handleWebhookRequest("mock", body, "00".repeat(32))).toEqual({ status: 400, body: "bad_signature" });
    expect((await order(_id))?.status).toBe("pending");
  });

  it("refunds only a paid order of the same provider", async () => {
    const paid = await seedOrder(product);
    await (await collections()).orders.updateOne({ _id: paid._id }, { $set: { providerPaymentId: `mockpay_${paid._id}` } });
    const refund = mockEvent(paid._id, "payment.refunded");
    await handleWebhookRequest("mock", refund.body, refund.signature);
    expect((await order(paid._id))?.status).toBe("refunded");

    const stripePaid = await seedOrder(product, { provider: "stripe", providerSessionId: "cs_test_1" });
    const forged = mockEvent(stripePaid._id, "payment.refunded");
    await handleWebhookRequest("mock", forged.body, forged.signature);
    expect((await order(stripePaid._id))?.status).toBe("paid");
  });
});

describe("free orders", () => {
  it("marks only a real zero-amount free order paid", async () => {
    const free = await pending({ provider: "free", providerSessionId: null, totalCents: 0 });
    const notFree = await pending({ provider: "free", providerSessionId: null, totalCents: 500 });
    await markFreeOrderPaid(free._id);
    await markFreeOrderPaid(notFree._id);
    await settle();
    expect((await order(free._id))?.status).toBe("paid");
    expect((await order(notFree._id))?.status).toBe("pending");
  });
});
