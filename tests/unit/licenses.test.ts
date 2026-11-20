import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, storeQueries, userId, OPEN_ACCESS } from "./auth-mocks";

// D-114: license key format, issuing once per paid order, statuses, the verify API and the creator actions.

const db = vi.hoisted(() => {
  const coll = () => ({ findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn() });
  return { orders: coll(), products: coll(), stores: coll(), licenseKeys: coll() };
});
const Duplicate = vi.hoisted(() => class Duplicate extends Error {
  constructor(public field: string) {
    super("dup");
  }
});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown, field?: string) => error instanceof Duplicate && (!field || error.field === field) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST, OPTIONS } from "@/app/api/licenses/verify/route";
import { getClientIpHash } from "@/lib/request-ip";
import { renderOrderEmail } from "@/lib/email/templates";
import { saveProductLicenseAction, setOrderLicenseRevokedAction } from "@/lib/licenses/actions";
import { issueLicenseForOrder, licenseOfOrder, verifyLicense } from "@/lib/licenses/queries";
import { LICENSE_KEY, formatLicenseKey, normalizeLicenseKey } from "@/lib/licenses/rules";

const ORDER = "11111111-0000-4000-8000-000000000001";
const PRODUCT = "22222222-0000-4000-8000-000000000001";
const KEY = "ABCDE-FGHJK-MNPQR-STVWX";

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue({ access: OPEN_ACCESS, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  db.orders.findOne.mockResolvedValue({ _id: ORDER, storeId: "store-1", productId: PRODUCT, status: "paid" });
  db.products.findOne.mockResolvedValue({ _id: PRODUCT, title: "Icon pack" });
  db.licenseKeys.insertOne.mockResolvedValue({});
  db.licenseKeys.updateOne.mockResolvedValue({ matchedCount: 1 });
  db.stores.findOne.mockResolvedValue({ _id: "store-1" });
});

describe("license key format", () => {
  it("makes four groups of five easy-to-read characters", () => {
    const key = formatLicenseKey(new Uint8Array(20).map((_, i) => i * 13));
    expect(key).toMatch(LICENSE_KEY);
    expect(key).not.toMatch(/[ILOU]/);
  });

  it("reads keys typed with spaces, lower case, no dashes or look-alike letters", () => {
    expect(normalizeLicenseKey(" abcde fghjk mnpqr stvwx ")).toBe(KEY);
    expect(normalizeLicenseKey("ABCDEFGHJKMNPQRSTVWX")).toBe(KEY);
    expect(normalizeLicenseKey("O0000-IIIII-LLLLL-00000")).toBe("00000-11111-11111-00000");
    expect(normalizeLicenseKey("ABCDE-FGHJK")).toBeNull();
    expect(normalizeLicenseKey("ABCDE-FGHJK-MNPQR-STVWU")).toBeNull();
    expect(normalizeLicenseKey(42)).toBeNull();
  });
});

describe("issuing", () => {
  it("issues a key for a paid order of a product with keys on, scoped to its store", async () => {
    const key = await issueLicenseForOrder(ORDER);
    expect(key).toMatch(LICENSE_KEY);
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, status: "paid" });
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual({ _id: PRODUCT, storeId: "store-1", type: "digital", "license.enabled": true });
    expect(db.licenseKeys.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1", productId: PRODUCT, orderId: ORDER, key, revokedAt: null }));
  });

  it("gives nothing for an unpaid order or a product without keys", async () => {
    db.orders.findOne.mockResolvedValueOnce(null);
    expect(await issueLicenseForOrder(ORDER)).toBeNull();
    db.products.findOne.mockResolvedValueOnce(null);
    expect(await issueLicenseForOrder(ORDER)).toBeNull();
    expect(db.licenseKeys.insertOne).not.toHaveBeenCalled();
  });

  it("keeps the order's first key when the payment event is replayed", async () => {
    db.licenseKeys.insertOne.mockRejectedValueOnce(new Duplicate("orderId"));
    db.licenseKeys.findOne.mockResolvedValueOnce({ key: KEY });
    expect(await issueLicenseForOrder(ORDER)).toBe(KEY);
    expect(db.licenseKeys.insertOne).toHaveBeenCalledTimes(1);
  });

  it("tries a new key once if a key ever clashed", async () => {
    db.licenseKeys.insertOne.mockRejectedValueOnce(new Duplicate("key"));
    expect(await issueLicenseForOrder(ORDER)).toMatch(LICENSE_KEY);
    expect(db.licenseKeys.insertOne).toHaveBeenCalledTimes(2);
  });
});

describe("status and verification", () => {
  it("is active while paid and not revoked, then revoked or refunded", async () => {
    db.licenseKeys.findOne.mockResolvedValue({ key: KEY, revokedAt: null, storeId: "store-1" });
    expect(await licenseOfOrder(ORDER)).toEqual({ key: KEY, status: "active" });
    db.licenseKeys.findOne.mockResolvedValue({ key: KEY, revokedAt: new Date(), storeId: "store-1" });
    expect(await licenseOfOrder(ORDER)).toEqual({ key: KEY, status: "revoked" });
    db.orders.findOne.mockResolvedValue({ status: "refunded" });
    expect(await licenseOfOrder(ORDER)).toEqual({ key: KEY, status: "refunded" });
  });

  it("verifies a key within the named store only, and returns no buyer details", async () => {
    db.licenseKeys.findOne.mockResolvedValue({ orderId: ORDER, productId: PRODUCT, revokedAt: null });
    expect(await verifyLicense("maya", " abcde-fghjk-mnpqr-stvwx")).toEqual({ valid: true, product: "Icon pack" });
    expect(db.stores.findOne.mock.calls[0]?.[0]).toEqual({ slug: "maya" });
    expect(db.licenseKeys.findOne.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", key: KEY });
    db.orders.findOne.mockResolvedValue({ status: "refunded" });
    expect(await verifyLicense("maya", KEY)).toEqual({ valid: false, reason: "refunded" });
    db.stores.findOne.mockResolvedValue(null);
    expect(await verifyLicense("other", KEY)).toEqual({ valid: false, reason: "not_found" });
    expect(await verifyLicense("maya", "nope")).toEqual({ valid: false, reason: "not_found" });
  });
});

describe("verify API", () => {
  const post = (body: string) => POST(new Request("https://pickstall.store/api/licenses/verify", { method: "POST", body }) as never);

  it("answers JSON to any origin, with no caching", async () => {
    db.licenseKeys.findOne.mockResolvedValue({ orderId: ORDER, productId: PRODUCT, revokedAt: null });
    const response = await post(JSON.stringify({ store: "Maya", key: KEY }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true, product: "Icon pack" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(OPTIONS().status).toBe(204);
  });

  it("refuses bad bodies and too many tries", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ key: KEY }))).status).toBe(400);
    expect((await post("x".repeat(2000))).status).toBe(413);
    // auth-mocks gives no IP hash by default; the limit applies per network address.
    vi.mocked(getClientIpHash).mockResolvedValueOnce("iphash");
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect((await post(JSON.stringify({ store: "maya", key: KEY }))).status).toBe(429);
    expect(db.licenseKeys.findOne).not.toHaveBeenCalled();
  });
});

describe("creator actions", () => {
  it("turn keys on only for the session's own digital product", async () => {
    db.products.updateOne = vi.fn(async () => ({ matchedCount: 1 }));
    expect(await saveProductLicenseAction(PRODUCT, true)).toEqual({ ok: true, data: { enabled: true } });
    expect(db.products.updateOne.mock.calls[0]).toEqual([{ _id: PRODUCT, storeId: "store-1", type: "digital", deletedAt: null }, expect.objectContaining({ $set: expect.objectContaining({ license: { enabled: true } }) })]);
    expect(await saveProductLicenseAction("nope", true)).toMatchObject({ ok: false });
  });

  it("revoke and restore only the session's own order key", async () => {
    expect(await setOrderLicenseRevokedAction(ORDER, true)).toEqual({ ok: true, data: { revoked: true } });
    expect(db.licenseKeys.updateOne.mock.calls[0]?.[0]).toEqual({ orderId: ORDER, storeId: "store-1" });
    expect(db.licenseKeys.updateOne.mock.calls[0]?.[1]).toEqual({ $set: { revokedAt: expect.any(Date) } });
    expect(await setOrderLicenseRevokedAction(ORDER, false)).toMatchObject({ ok: true });
    expect(db.licenseKeys.updateOne.mock.calls[1]?.[1]).toEqual({ $set: { revokedAt: null } });
    db.licenseKeys.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await setOrderLicenseRevokedAction(ORDER, true)).toMatchObject({ ok: false });
  });
});

describe("confirmation email", () => {
  it("always carries the key, whatever the creator wrote", () => {
    const email = renderOrderEmail({ storeName: "Maya", vars: { customerName: "Asha", productTitle: "Icon pack", accessLink: "https://pickstall.store/welcome/t" }, subject: null, body: "Thanks!", licenseKey: KEY });
    expect(email.text).toContain(KEY);
    expect(email.html).toContain(KEY);
    expect(renderOrderEmail({ storeName: "Maya", vars: { customerName: "A", productTitle: "P", accessLink: "https://x.test/w" }, subject: null, body: null }).text).not.toContain("license key");
  });
});
