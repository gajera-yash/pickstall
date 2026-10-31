import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  ordersFindOne: vi.fn(),
  ordersUpdateOne: vi.fn(),
  productsFindOne: vi.fn(),
  user: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({
    orders: { findOne: db.ordersFindOne, updateOne: db.ordersUpdateOne },
    products: { findOne: db.productsFindOne },
  })),
}));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: db.user }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (scope: string, value: string) => `${scope}:${value}`, takeRateLimit: db.rate }));

import { POST } from "@/app/library/[orderId]/open/route";
import { grantAccess } from "@/lib/library/queries";

const ORDER = "11111111-2222-4333-8444-555555555555";
const paid = { _id: ORDER, productId: "p1", storeId: "s1", status: "paid" };

describe("grantAccess (the only place the delivery link leaves the server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.ordersFindOne.mockResolvedValue(paid);
    db.productsFindOne.mockResolvedValue({ externalUrl: "https://drive.example.com/secret", downloadLimit: null });
    db.ordersUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("gives the link for a paid order of this buyer, matching the email in lowercase", async () => {
    expect(await grantAccess(" Maya@Example.com ", ORDER)).toEqual({ ok: true, url: "https://drive.example.com/secret" });
    expect(db.ordersFindOne).toHaveBeenCalledWith({ _id: ORDER, buyerEmail: "maya@example.com" }, expect.anything());
    expect(db.ordersUpdateOne.mock.calls[0]?.[0]).toMatchObject({ _id: ORDER, buyerEmail: "maya@example.com", status: "paid" });
  });

  it("treats someone else's order exactly like a missing one", async () => {
    db.ordersFindOne.mockResolvedValue(null);
    expect(await grantAccess("other@example.com", ORDER)).toEqual({ ok: false, reason: "not_found" });
    expect(db.ordersUpdateOne).not.toHaveBeenCalled();
  });

  it("removes access after a refund and never serves a pending order", async () => {
    db.ordersFindOne.mockResolvedValue({ ...paid, status: "refunded" });
    expect(await grantAccess("maya@example.com", ORDER)).toEqual({ ok: false, reason: "refunded" });
    db.ordersFindOne.mockResolvedValue({ ...paid, status: "pending" });
    expect(await grantAccess("maya@example.com", ORDER)).toEqual({ ok: false, reason: "not_found" });
    expect(db.productsFindOne).not.toHaveBeenCalled();
  });

  it("says unavailable when the product is gone or has no link", async () => {
    db.productsFindOne.mockResolvedValue(null);
    expect(await grantAccess("maya@example.com", ORDER)).toEqual({ ok: false, reason: "unavailable" });
    db.productsFindOne.mockResolvedValue({ externalUrl: null, downloadLimit: null });
    expect(await grantAccess("maya@example.com", ORDER)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("enforces the download limit inside one atomic update", async () => {
    db.productsFindOne.mockResolvedValue({ externalUrl: "https://drive.example.com/secret", downloadLimit: 2 });
    expect((await grantAccess("maya@example.com", ORDER)).ok).toBe(true);
    const filter = db.ordersUpdateOne.mock.calls[0]?.[0] as { $or: unknown[] };
    expect(filter.$or).toEqual([{ accessCount: { $lt: 2 } }, { accessCount: { $exists: false } }]);
    db.ordersUpdateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await grantAccess("maya@example.com", ORDER)).toEqual({ ok: false, reason: "limit" });
  });
});

describe("POST /library/[orderId]/open", () => {
  const call = (origin?: string, id = ORDER) =>
    POST(new Request(`http://localhost:3000/library/${id}/open`, { method: "POST", headers: origin ? { origin } : {} }) as never, { params: Promise.resolve({ orderId: id }) });

  beforeEach(() => {
    vi.clearAllMocks();
    db.user.mockResolvedValue({ id: "u1", email: "maya@example.com" });
    db.rate.mockResolvedValue(true);
    db.ordersFindOne.mockResolvedValue(paid);
    db.productsFindOne.mockResolvedValue({ externalUrl: "https://drive.example.com/secret", downloadLimit: null });
    db.ordersUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("redirects a signed-in buyer to the delivery link, with no referrer", async () => {
    const response = await call("http://localhost:3000");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://drive.example.com/secret");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("refuses a form posted from another site", async () => {
    expect((await call("https://evil.example.com")).status).toBe(403);
    expect(db.ordersFindOne).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in first", async () => {
    db.user.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/login?next=");
    expect(db.ordersFindOne).not.toHaveBeenCalled();
  });

  it("goes back to the purchase with a reason instead of leaking anything", async () => {
    db.ordersFindOne.mockResolvedValue({ ...paid, status: "refunded" });
    const response = await call();
    expect(response.headers.get("location")).toBe(`http://localhost:3000/library/${ORDER}?problem=refunded`);
  });

  it("ignores ids that are not uuids and is rate limited", async () => {
    expect((await call(undefined, "../etc")).headers.get("location")).toBe("http://localhost:3000/library");
    db.rate.mockResolvedValue(false);
    expect((await call()).headers.get("location")).toContain("problem=slow");
  });

  it("does not redirect to a link that is not https", async () => {
    db.productsFindOne.mockResolvedValue({ externalUrl: "http://plain.example.com/x", downloadLimit: null });
    expect((await call()).headers.get("location")).toContain("problem=unavailable");
  });
});
