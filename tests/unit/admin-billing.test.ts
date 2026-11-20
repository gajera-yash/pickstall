import { beforeEach, describe, expect, it, vi } from "vitest";

// D-116: plan payments saved once, real MRR, the admin billing numbers, CSV exports and the audit list.

const db = vi.hoisted(() => {
  const cursor = (rows: unknown[]) => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }) }), toArray: async () => rows });
  return {
    cursor,
    stores: { find: vi.fn(), findOne: vi.fn() },
    planPayments: { insertOne: vi.fn(), aggregate: vi.fn(), find: vi.fn(), estimatedDocumentCount: vi.fn() },
    auditLogs: { find: vi.fn() },
  };
});
const Duplicate = vi.hoisted(() => class Duplicate extends Error {});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => error instanceof Duplicate, getDb: vi.fn() }));

import { adminBilling, monthlyCents } from "@/lib/admin/billing";
import { creatorsCsv, planPaymentsCsv } from "@/lib/admin/csv";
import { adminListAudit, trialConversion } from "@/lib/admin/queries";
import { savePlanPayment } from "@/lib/plans/payments";

const NOW = new Date("2026-11-20T12:00:00Z");
const invoice = { invoiceId: "in_1", customerId: "cus_1", subscriptionId: "sub_1", storeId: null, plan: "pro" as const, amountPaidCents: 4900, currency: "usd", paidAt: new Date("2026-11-02T00:00:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  db.planPayments.insertOne.mockResolvedValue({});
});

describe("plan payments", () => {
  it("are saved once by invoice id, finding the store by its Stripe customer", async () => {
    db.stores.findOne.mockResolvedValue({ _id: "store-1" });
    expect(await savePlanPayment(invoice, NOW)).toBe(true);
    expect(db.stores.findOne.mock.calls[0]?.[0]).toEqual({ "billing.customerId": "cus_1" });
    expect(db.planPayments.insertOne).toHaveBeenCalledWith(expect.objectContaining({ _id: "in_1", storeId: "store-1", plan: "pro", amountCents: 4900, currency: "usd" }));
    db.planPayments.insertOne.mockRejectedValueOnce(new Duplicate());
    expect(await savePlanPayment(invoice, NOW)).toBe(false);
  });

  it("use the store id from the invoice when Stripe has it", async () => {
    await savePlanPayment({ ...invoice, storeId: "store-9" }, NOW);
    expect(db.stores.findOne).not.toHaveBeenCalled();
    expect(db.planPayments.insertOne.mock.calls[0]?.[0].storeId).toBe("store-9");
  });
});

describe("MRR", () => {
  it("normalizes prices to a month, and falls back to the planned price for old rows", () => {
    expect(monthlyCents({ plan: "pro", amountCents: 4900, interval: "month" })).toBe(4900);
    expect(monthlyCents({ plan: "pro", amountCents: 48000, interval: "year" })).toBe(4000);
    expect(monthlyCents({ plan: "starter", amountCents: null, interval: null })).toBeGreaterThan(0);
  });

  it("counts active and past-due plans, lists payment problems and recent cancellations", async () => {
    const billing = (status: string, plan: "starter" | "pro", amountCents: number, updatedAt = NOW) => ({ customerId: "c", subscriptionId: "s", plan, status, currentPeriodEnd: null, cancelAtPeriodEnd: false, amountCents, currency: "usd", interval: "month", updatedAt });
    db.stores.find
      .mockReturnValueOnce(
        db.cursor([
          { _id: "a", name: "A", slug: "a", billing: billing("active", "pro", 4900) },
          { _id: "b", name: "B", slug: "b", billing: billing("past_due", "starter", 1900) },
          { _id: "c", name: "C", slug: "c", billing: billing("canceled", "pro", 4900, new Date("2026-11-10T00:00:00Z")) },
          { _id: "d", name: "D", slug: "d", billing: billing("canceled", "pro", 4900, new Date("2026-09-01T00:00:00Z")) },
        ]),
      )
      .mockReturnValueOnce(db.cursor([{ _id: "store-1", name: "Maya", slug: "maya" }]));
    db.planPayments.aggregate
      .mockReturnValueOnce(db.cursor([{ _id: "usd", cents: 20000 }]))
      .mockReturnValueOnce(db.cursor([{ _id: "usd", cents: 6800 }]))
      .mockReturnValueOnce(db.cursor([{ _id: "2026-11", cents: 6800 }]))
      .mockReturnValueOnce(db.cursor([{ _id: "store-1", first: new Date("2026-11-03") }]));
    db.planPayments.find.mockReturnValue(db.cursor([{ _id: "in_1", storeId: "store-1", plan: "pro", amountCents: 4900, currency: "usd", paidAt: NOW }]));
    db.planPayments.estimatedDocumentCount.mockResolvedValue(7);

    const data = await adminBilling(NOW);
    expect(data.mrr).toEqual([{ currency: "usd", cents: 6800 }]);
    expect(data.active).toEqual({ starter: 1, pro: 1 });
    expect(data.pastDue.map((row) => row.storeId)).toEqual(["b"]);
    expect(data.canceled30).toBe(1);
    expect(data.newThisMonth).toBe(1);
    expect(data.revenueAll).toEqual([{ currency: "usd", cents: 20000 }]);
    expect(data.months).toHaveLength(12);
    expect(data.months.at(-1)).toEqual({ label: "Nov 26", cents: 6800 });
    expect(data.recent[0]).toMatchObject({ storeName: "Maya", amountCents: 4900 });
  });
});

describe("conversion and exports", () => {
  it("measures how many ended trials now pay", () => {
    expect(trialConversion({ paidAfterTrial: 3, paused: 1 })).toBe(75);
    expect(trialConversion({ paidAfterTrial: 0, paused: 0 })).toBeNull();
  });

  it("neutralizes spreadsheet formulas in the CSVs", () => {
    const csv = creatorsCsv([{ id: "s1", name: "=HYPERLINK(1)", slug: "maya", ownerEmail: "m@x.co", isPublished: true, access: { state: "trial", endsAt: null, daysLeft: 3, plan: null, cancelsAtPeriodEnd: false }, stripeConnected: false, createdAt: NOW }]);
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
    expect(planPaymentsCsv([{ id: "in_1", paidAt: NOW, storeName: "+cmd", slug: "x", plan: "pro", amountCents: 4900, currency: "usd" }])).toContain("49.00");
  });
});

describe("the audit list", () => {
  it("filters by action or store and never shows user ids", async () => {
    db.auditLogs.find.mockReturnValue(db.cursor([
      { _id: "1", actorId: "admin:founder", storeId: "store-1", action: "admin.store_suspended", meta: { reason: "spam" }, at: NOW },
      { _id: "2", actorId: "user-123", storeId: null, action: "auth.signed_in", meta: {}, at: NOW },
    ]));
    db.stores.find.mockReturnValue(db.cursor([{ _id: "store-1", name: "Maya" }]));
    const { rows } = await adminListAudit({ action: "admin.store_suspended", storeId: "store-1" });
    expect(db.auditLogs.find.mock.calls[0]?.[0]).toEqual({ action: "admin.store_suspended", storeId: "store-1" });
    expect(rows.map((row) => row.actor)).toEqual(["admin: founder", "creator"]);
    expect(rows[0]?.storeName).toBe("Maya");
    expect(JSON.stringify(rows)).not.toContain("user-123");
  });
});
