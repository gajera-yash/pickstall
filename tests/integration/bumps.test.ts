import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// Order bumps (D-089) on a real MongoDB: settings stay inside one store, a paid order with a bump
// makes exactly one $0 bump order (also on a replayed webhook) that reaches the buyer's library, a
// full refund removes it, and creator lists and income count the sale once.

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (task: () => unknown) => void Promise.resolve().then(task) };
});

import { findCheckoutBump, listBumpCandidates, saveProductBump } from "@/lib/bumps/queries";
import { collections } from "@/lib/db/collections";
import { listPurchases } from "@/lib/library/queries";
import { countOrdersByStatus, incomeStats, listOrders } from "@/lib/orders/creator-queries";
import { signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest } from "@/lib/payments/process";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

async function setup() {
  const store = await seedStore();
  const main = await seedProduct(store._id, { title: "Playbook", priceCents: 1900 });
  const extra = await seedProduct(store._id, { title: "Workbook", priceCents: 1500 });
  return { store, main, extra };
}

function event(type: "payment.succeeded" | "payment.refunded", orderId: string, id = `evt_${randomUUID()}`) {
  const body = JSON.stringify({ id, type, orderId });
  return handleWebhookRequest("mock", body, signMockBody(body));
}

describe("bump settings", () => {
  it("can only offer another product of the same store", async () => {
    const a = await setup();
    const b = await setup();
    expect(await saveProductBump(a.store._id, a.main._id, { productId: a.extra._id, priceCents: 900, headline: null })).toBe("saved");
    expect(await saveProductBump(a.store._id, a.main._id, { productId: b.extra._id, priceCents: 900, headline: null })).toBe("bad_product");
    expect(await saveProductBump(a.store._id, a.main._id, { productId: a.main._id, priceCents: 900, headline: null })).toBe("bad_product");
    expect(await saveProductBump(b.store._id, a.main._id, { productId: b.extra._id, priceCents: 900, headline: null })).toBe("not_found");
    expect((await listBumpCandidates(a.store._id, a.main._id)).map((item) => item.id)).toEqual([a.extra._id]);
    expect(await findCheckoutBump(a.store._id, { productId: a.extra._id, priceCents: 900, headline: null })).toMatchObject({ title: "Workbook", priceCents: 900 });
    expect(await findCheckoutBump(b.store._id, { productId: a.extra._id, priceCents: 900, headline: null })).toBeNull();
  });
});

describe("a paid order with a bump", () => {
  it("makes one bump order that reaches the library, counted once in lists and income, removed by a refund", async () => {
    const { store, main, extra } = await setup();
    const email = `buyer-${randomUUID().slice(0, 6)}@example.com`;
    const order = await seedOrder(main, {
      status: "pending",
      paidAt: null,
      buyerEmail: email,
      subtotalCents: 2800,
      totalCents: 2800,
      bump: { productId: extra._id, title: "Workbook", priceCents: 900 },
    });

    const eventId = `evt_${randomUUID()}`;
    expect((await event("payment.succeeded", order._id, eventId)).status).toBe(200);
    expect((await event("payment.succeeded", order._id, `evt_${randomUUID()}`)).status).toBe(200); // a second, different delivery
    const { orders } = await collections();
    const bumpOrders = await orders.find({ bumpOf: order._id }).toArray();
    expect(bumpOrders).toHaveLength(1);
    expect(bumpOrders[0]).toMatchObject({ productId: extra._id, status: "paid", totalCents: 0, buyerEmail: email });

    // The buyer sees both products.
    expect((await listPurchases(email)).map((purchase) => purchase.title).sort()).toEqual(["Playbook", "Workbook"]);

    // The creator sees one order of $28 and income counts it once.
    const page = await listOrders(store._id, {});
    expect(page.orders.map((row) => row.id)).toEqual([order._id]);
    expect((await countOrdersByStatus(store._id)).paid).toBe(1);
    const stats = await incomeStats(store._id, "usd", 30);
    expect(stats.totalPaidOrders).toBe(1);

    // A full refund removes the bump product too.
    await orders.updateOne({ _id: order._id }, { $set: { providerPaymentId: `mockpay_${order._id}` } });
    expect((await event("payment.refunded", order._id)).status).toBe(200);
    expect((await orders.findOne({ bumpOf: order._id }))?.status).toBe("refunded");
  });

  it("makes no bump order for an order without a bump", async () => {
    const { main } = await setup();
    const order = await seedOrder(main, { status: "pending", paidAt: null });
    expect((await event("payment.succeeded", order._id)).status).toBe(200);
    const { orders } = await collections();
    expect(await orders.countDocuments({ bumpOf: order._id })).toBe(0);
  });
});
