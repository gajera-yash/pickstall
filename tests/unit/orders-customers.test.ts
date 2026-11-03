import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeCustomerCursor, parseCustomerParams, parseOrderParams, withQuery } from "@/lib/orders/params";

// Part D: orders and customers tables, drawers, filters and the orders CSV.

const ORDER = "3f2a9c1b-0000-4000-8000-000000000001";
const PRODUCT = "7c1d2e3f-0000-4000-8000-000000000002";

describe("Orders and Customers query strings", () => {
  it("keeps a uuid product filter and drawer id, and drops anything else", () => {
    expect(parseOrderParams({ product: PRODUCT, order: ORDER })).toEqual({ product: PRODUCT, order: ORDER });
    expect(parseOrderParams({ product: "{ $ne: 1 }", order: "../x" })).toEqual({});
  });

  it("reads the customer cursor as a date and an order id, never an email", () => {
    const cursor = { at: new Date("2026-11-02T10:00:00.000Z"), id: ORDER };
    expect(parseCustomerParams({ after: encodeCustomerCursor(cursor), customer: ORDER, q: " maya ", product: PRODUCT })).toEqual({ after: cursor, customer: ORDER, q: "maya", product: PRODUCT });
    expect(parseCustomerParams({ after: "2026-11-02T10:00:00.000Z~bob@example.com", customer: "bob@example.com" })).toEqual({});
    expect(parseCustomerParams({ after: "yesterday" })).toEqual({});
  });

  it("builds links with only the set values", () => {
    expect(withQuery("/dashboard/orders", { status: "paid", q: undefined, order: ORDER })).toBe(`/dashboard/orders?status=paid&order=${ORDER}`);
    expect(withQuery("/dashboard/orders", {})).toBe("/dashboard/orders");
  });
});

const db = vi.hoisted(() => ({
  orders: { find: vi.fn(), findOne: vi.fn(), aggregate: vi.fn() },
  products: { findOne: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { findCustomerDetail, findOrderDetail, listCustomers, listOrders } from "@/lib/orders/creator-queries";
import { ordersCsv } from "@/lib/orders/export";

const cursor = (rows: unknown[]) => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }) }) });

const orderDoc = (over: Record<string, unknown> = {}) => ({
  _id: ORDER,
  storeId: "store-1",
  productId: PRODUCT,
  item: { title: "Guide", unitPriceCents: 2000 },
  buyerName: "Maya",
  buyerEmail: "maya@example.com",
  buyerPhone: null,
  answers: [],
  subtotalCents: 2000,
  discountCents: 500,
  totalCents: 1500,
  currency: "usd",
  status: "paid",
  provider: "mock",
  accessCount: 2,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  paidAt: new Date("2026-11-01T00:01:00Z"),
  ...over,
});

describe("order and customer queries stay inside the store (ownership)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orders.find.mockReturnValue(cursor([]));
    db.orders.aggregate.mockReturnValue({ toArray: async () => [] });
  });

  it("filters the order list and the export by product, always with the store id", async () => {
    await listOrders("store-1", { product: PRODUCT });
    // The route tests below mock listOrdersForExport for the whole file; check the real one here.
    const actual = await vi.importActual<typeof import("@/lib/orders/creator-queries")>("@/lib/orders/creator-queries");
    await actual.listOrdersForExport("store-1", { status: "refunded", product: PRODUCT });
    expect(db.orders.find.mock.calls[0]?.[0]).toMatchObject({ storeId: "store-1", productId: PRODUCT });
    expect(db.orders.find.mock.calls[1]?.[0]).toMatchObject({ storeId: "store-1", status: "refunded", productId: PRODUCT });
  });

  it("finds an order for the drawer only inside the store, with its download limit", async () => {
    db.orders.findOne.mockResolvedValue(orderDoc());
    db.products.findOne.mockResolvedValue({ downloadLimit: 5 });
    const detail = await findOrderDetail("store-1", ORDER);
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: ORDER, storeId: "store-1" });
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual({ _id: PRODUCT, storeId: "store-1" });
    expect(detail).toMatchObject({ id: ORDER, discountCents: 500, accessCount: 2, downloadLimit: 5 });
  });

  it("returns null for another store's order", async () => {
    db.orders.findOne.mockResolvedValue(null);
    expect(await findOrderDetail("store-2", ORDER)).toBeNull();
    expect(await findCustomerDetail("store-2", ORDER)).toBeNull();
    expect(db.orders.find).not.toHaveBeenCalled();
  });

  it("builds a customer from that store's paid orders only", async () => {
    db.orders.findOne.mockResolvedValue({ buyerEmail: "maya@example.com" });
    db.orders.find.mockReturnValue(cursor([orderDoc({ _id: "o2", totalCents: 1000 }), orderDoc({ _id: "o1", buyerPhone: "+1 555", paidAt: new Date("2026-10-01T00:00:00Z") })]));
    const customer = await findCustomerDetail("store-1", ORDER);
    expect(db.orders.find.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", buyerEmail: "maya@example.com", status: "paid" });
    expect(customer).toMatchObject({ key: "o2", orderCount: 2, totalCents: 2500, phone: "+1 555", firstOrderAt: new Date("2026-10-01T00:00:00Z") });
  });

  it("filters customers by product and pages by their latest order", async () => {
    const after = { at: new Date("2026-11-01T00:00:00Z"), id: ORDER };
    const group = (id: string) => ({ _id: `${id}@x.co`, name: id, phone: null, orderCount: 1, totalCents: 100, lastOrderAt: new Date("2026-10-01T00:00:00Z"), lastOrderId: id, products: ["Guide"], productIds: [PRODUCT], answersCount: 0 });
    db.orders.aggregate.mockReturnValue({ toArray: async () => [group("b"), group("a")] });
    const page = await listCustomers("store-1", { product: PRODUCT, after, limit: 1 });

    const pipeline = db.orders.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { storeId: "store-1", status: "paid" } });
    expect(pipeline).toContainEqual({ $match: { productIds: PRODUCT } });
    expect(pipeline).toContainEqual({ $match: { $or: [{ lastOrderAt: { $lt: after.at } }, { lastOrderAt: after.at, lastOrderId: { $lt: ORDER } }] } });
    expect(page.customers.map((customer) => customer.key)).toEqual(["b"]);
    expect(page.next).toEqual({ at: new Date("2026-10-01T00:00:00Z"), id: "b" });
  });
});

describe("orders CSV", () => {
  const row = { id: ORDER, productId: PRODUCT, title: "Guide", buyerName: "+cmd", buyerEmail: "a@b.co", totalCents: 500, currency: "jpy", status: "refunded" as const, provider: "stripe" as const, answers: [], createdAt: new Date("2026-11-01T00:00:00Z") };

  it("writes the currency's own decimals, a status column and neutralized text", () => {
    const csv = ordersCsv([row], { withStatus: true });
    expect(csv).toContain('"Status"');
    expect(csv).toContain('"500","JPY","refunded"');
    expect(csv).toContain('"\'+cmd"');
    expect(ordersCsv([{ ...row, currency: "usd", totalCents: 1999 }], { withStatus: false })).not.toContain("Status");
  });
});

const guards = vi.hoisted(() => ({ getCurrentUser: vi.fn(), findStoreByOwner: vi.fn(), takeRateLimit: vi.fn(), listForExport: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: guards.getCurrentUser }));
vi.mock("@/lib/stores/queries", () => ({ findStoreByOwner: guards.findStoreByOwner }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (scope: string, value: string) => `${scope}:${value}`, takeRateLimit: guards.takeRateLimit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/orders/creator-queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/creator-queries")>("@/lib/orders/creator-queries");
  return { ...actual, listOrdersForExport: guards.listForExport };
});

import { NextRequest } from "next/server";

import { GET } from "@/app/dashboard/orders/export/route";

describe("orders CSV export route", () => {
  const request = (query: string) => new NextRequest(`http://localhost/dashboard/orders/export${query}`);

  beforeEach(() => {
    vi.clearAllMocks();
    guards.takeRateLimit.mockResolvedValue(true);
    guards.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
    guards.listForExport.mockResolvedValue([]);
  });

  it("refuses a signed-out visitor", async () => {
    guards.getCurrentUser.mockResolvedValue(null);
    expect((await GET(request(""))).status).toBe(401);
    expect(guards.listForExport).not.toHaveBeenCalled();
  });

  it("exports the session owner's store with only valid filters", async () => {
    guards.getCurrentUser.mockResolvedValue({ id: "user-1" });
    const response = await GET(request(`?status=$ne&product=${PRODUCT}&q=maya&storeId=store-2`));
    expect(response.status).toBe(200);
    expect(guards.listForExport).toHaveBeenCalledWith("store-1", { status: undefined, q: "maya", product: PRODUCT });
    expect(response.headers.get("content-disposition")).toContain("maya-orders.csv");
  });

  it("is rate limited", async () => {
    guards.getCurrentUser.mockResolvedValue({ id: "user-1" });
    guards.takeRateLimit.mockResolvedValue(false);
    expect((await GET(request(""))).status).toBe(429);
  });
});
