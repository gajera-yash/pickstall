import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCsv, csvCell, escapeRegex, neutralizeFormula } from "@/lib/orders/csv";
import { parseOrderParams } from "@/lib/orders/params";
import { buildSeries, lastDays, lastSum, utcDay } from "@/lib/orders/series";

describe("daily series", () => {
  const now = new Date("2026-11-02T10:30:00Z");

  it("lists UTC days oldest first, ending today", () => {
    expect(lastDays(3, now)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(utcDay(new Date("2026-11-02T23:59:59Z"))).toBe("2026-11-02");
  });

  it("fills missing days with real zeros", () => {
    const series = buildSeries(
      [
        { day: "2026-11-01", revenueCents: 1900, orders: 1, customers: 1 },
        { day: "2026-11-02", revenueCents: 2000, orders: 2, customers: 2 },
        { day: "2025-01-01", revenueCents: 99999, orders: 9, customers: 9 },
      ],
      3,
      now,
    );
    expect(series.revenueCents).toEqual([0, 1900, 2000]);
    expect(series.orders).toEqual([0, 1, 2]);
    expect(lastSum(series.revenueCents, 1)).toBe(2000);
    expect(lastSum(series.revenueCents, 3)).toBe(3900);
  });
});

describe("CSV export safety (D-014)", () => {
  it.each(["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tTAB", "\rCR"])("neutralizes the formula %j", (value) => {
    expect(neutralizeFormula(value).startsWith("'")).toBe(true);
  });

  it("leaves normal text alone", () => {
    expect(neutralizeFormula("Maya Patel")).toBe("Maya Patel");
    expect(neutralizeFormula("a=b")).toBe("a=b");
  });

  it("quotes cells so commas, quotes and line breaks cannot break a row", () => {
    expect(csvCell('He said "hi", then\nleft')).toBe('"He said ""hi"", then\nleft"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12)).toBe('"12"');
  });

  it("builds a CRLF file with a BOM and neutralized buyer text", () => {
    const csv = buildCsv(["Name", "Email"], [['=HYPERLINK("http://evil")', "a@b.co"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""http://evil"")"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("escapes regex characters so a search box can never be a pattern", () => {
    expect(escapeRegex("a.b*c(d)")).toBe("a\\.b\\*c\\(d\\)");
    expect(new RegExp(escapeRegex(".*"), "i").test("anything")).toBe(false);
  });
});

describe("parseOrderParams", () => {
  it("keeps valid values and drops everything else", () => {
    expect(parseOrderParams({ status: "paid", q: "  maya ", before: "2026-11-01T10:00:00.000Z" })).toEqual({
      status: "paid",
      q: "maya",
      before: new Date("2026-11-01T10:00:00.000Z"),
    });
    expect(parseOrderParams({ status: "$ne", q: "x".repeat(81), before: "yesterday" })).toEqual({});
    expect(parseOrderParams({ status: ["paid", "failed"] })).toEqual({ status: "paid" });
    expect(parseOrderParams({})).toEqual({});
  });
});

const db = vi.hoisted(() => ({
  find: vi.fn(),
  aggregate: vi.fn(),
  distinct: vi.fn(),
  countDocuments: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ orders: db })) }));

import { countOrdersByStatus, incomeStats, listCustomers, listOrders } from "@/lib/orders/creator-queries";

const cursor = (rows: unknown[]) => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }), toArray: async () => rows }), toArray: async () => rows });

describe("creator queries are scoped to the store (ownership)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.find.mockReturnValue(cursor([]));
    db.aggregate.mockReturnValue({ toArray: async () => [] });
    db.distinct.mockResolvedValue([]);
    db.countDocuments.mockResolvedValue(0);
  });

  it("listOrders always filters by storeId, and a search cannot widen it", async () => {
    await listOrders("store-1", { status: "paid", q: "x.*" });
    const filter = db.find.mock.calls[0]?.[0] as { storeId: string; status: string; $or: unknown[] };
    expect(filter.storeId).toBe("store-1");
    expect(filter.status).toBe("paid");
    expect(filter.$or).toHaveLength(2);
    expect(String((filter.$or[0] as { buyerEmail: RegExp }).buyerEmail)).toBe("/x\\.\\*/i");
  });

  it("listOrders pages by createdAt and reports the next cursor", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      _id: `o${index}`,
      item: { title: "P" },
      buyerName: "A",
      buyerEmail: "a@b.co",
      totalCents: 100,
      currency: "usd",
      status: "paid",
      provider: "mock",
      answers: [],
      createdAt: new Date(`2026-11-0${3 - index}T00:00:00Z`),
    }));
    db.find.mockReturnValue(cursor(rows));
    const page = await listOrders("store-1", { limit: 2 });
    expect(page.orders).toHaveLength(2);
    expect(page.nextBefore).toBe("2026-11-02T00:00:00.000Z");
  });

  it("every aggregation starts with a match on storeId", async () => {
    await countOrdersByStatus("store-1");
    await listCustomers("store-1");
    await incomeStats("store-1", "usd", 30, new Date("2026-11-02T00:00:00Z"));
    for (const call of db.aggregate.mock.calls) {
      const first = (call[0] as { $match?: { storeId?: string } }[])[0];
      expect(first?.$match?.storeId).toBe("store-1");
    }
    expect(db.distinct.mock.calls[0]?.[1]).toMatchObject({ storeId: "store-1", status: "paid", currency: "usd" });
    expect(db.countDocuments).toHaveBeenCalledWith({ storeId: "store-1", status: "paid" });
  });

  it("customers only come from paid orders", async () => {
    await listCustomers("store-1");
    const pipeline = db.aggregate.mock.calls[0]?.[0] as { $match: { status: string } }[];
    expect(pipeline[0]?.$match.status).toBe("paid");
  });

  it("income counts only paid orders of the store's currency", async () => {
    await incomeStats("store-1", "gbp", 7, new Date("2026-11-02T00:00:00Z"));
    const first = (db.aggregate.mock.calls[0]?.[0] as { $match: Record<string, unknown> }[])[0];
    expect(first?.$match).toMatchObject({ storeId: "store-1", status: "paid", currency: "gbp" });
  });
});

const guards = vi.hoisted(() => ({ getCurrentUser: vi.fn(), findStoreByOwner: vi.fn(), takeRateLimit: vi.fn(), listPaid: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: guards.getCurrentUser }));
vi.mock("@/lib/stores/queries", () => ({ findStoreByOwner: guards.findStoreByOwner }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (scope: string, value: string) => `${scope}:${value}`, takeRateLimit: guards.takeRateLimit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/orders/creator-queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/creator-queries")>("@/lib/orders/creator-queries");
  return { ...actual, listPaidOrdersForExport: guards.listPaid };
});

import { GET } from "@/app/dashboard/customers/export/route";

describe("CSV export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guards.takeRateLimit.mockResolvedValue(true);
    guards.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
    guards.listPaid.mockResolvedValue([
      { id: "o1", title: "Guide", buyerName: "=EVIL()", buyerEmail: "a@b.co", totalCents: 1999, currency: "usd", provider: "stripe", answers: [{ questionId: "q", label: "Handle", value: "@maya" }], createdAt: new Date("2026-11-01T00:00:00Z") },
    ]);
  });

  it("refuses a signed-out visitor", async () => {
    guards.getCurrentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(guards.listPaid).not.toHaveBeenCalled();
  });

  it("exports the session owner's own store, with neutralized cells and an answers column", async () => {
    guards.getCurrentUser.mockResolvedValue({ id: "user-1", email: "maya@example.com" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(guards.listPaid).toHaveBeenCalledWith("store-1");
    expect(response.headers.get("content-disposition")).toContain("maya-customers.csv");
    const body = await response.text();
    expect(body).toContain('"\'=EVIL()"');
    expect(body).toContain('"Handle"');
    expect(body).toContain('"19.99"');
  });

  it("is rate limited", async () => {
    guards.getCurrentUser.mockResolvedValue({ id: "user-1", email: "maya@example.com" });
    guards.takeRateLimit.mockResolvedValue(false);
    expect((await GET()).status).toBe(429);
  });
});
