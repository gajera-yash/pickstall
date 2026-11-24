import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

// D-119 on a real MongoDB: the creator funnel counts each step for stores created in the period.

import { collections } from "@/lib/db/collections";
import { creatorFunnel } from "@/lib/marketing/funnel";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

const DAY = 24 * 60 * 60 * 1000;

describe("creatorFunnel", () => {
  it("counts the cohort's steps overall and by source", async () => {
    const now = new Date();
    const outreach = { ref: "lead-2", source: "outreach", medium: null, campaign: null, referrer: null };
    // Full journey from outreach: published, PayPal connected, a real sale, a paid plan.
    const star = await seedStore({ isPublished: true, publishedAt: now, acquisition: outreach, paypal: { mode: "sandbox", clientId: "c", secretSealed: "s", webhookId: null, connectedAt: now } });
    const product = await seedProduct(star._id);
    await seedOrder(product, { provider: "paypal" });
    const { planPayments, auditLogs } = await collections();
    await planPayments.insertOne({ _id: randomUUID(), storeId: star._id, customerId: "cus", subscriptionId: null, plan: "starter", amountCents: 1900, currency: "usd", paidAt: now, createdAt: now });
    // Outreach store that connected PayPal once (audit) but only had a mock and a free order.
    const tried = await seedStore({ isPublished: false, acquisition: outreach });
    await auditLogs.insertOne({ _id: randomUUID(), actorId: tried.ownerId, storeId: tried._id, action: "paypal.connected", meta: {}, ipHash: null, at: now });
    const triedProduct = await seedProduct(tried._id);
    await seedOrder(triedProduct);
    await seedOrder(triedProduct, { provider: "free", totalCents: 0 });
    // Direct store, published before D-119 (no publishedAt).
    await seedStore({ isPublished: true });
    // Outside the period: not counted.
    await seedStore({ createdAt: new Date(now.getTime() - 40 * DAY), acquisition: outreach });

    // A minute of headroom: the first collections() call builds every index, which can take seconds.
    const funnel = await creatorFunnel(30, new Date(now.getTime() + 60_000));
    expect(funnel.total).toEqual({ signups: 3, published: 2, paymentConnected: 2, firstSale: 1, paidPlan: 1 });
    expect(funnel.bySource).toEqual([
      { source: "outreach", signups: 2, published: 1, paymentConnected: 2, firstSale: 1, paidPlan: 1 },
      { source: "direct", signups: 1, published: 1, paymentConnected: 0, firstSale: 0, paidPlan: 0 },
    ]);
  });
});
