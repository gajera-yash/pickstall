import { beforeEach, describe, expect, it, vi } from "vitest";

// Product import (Gumroad API, CSV for Stan): cleaning and mapping rules, drafts only in the
// session owner's store, a repeat import adds nothing twice, and the Gumroad token is never kept.

const hoisted = vi.hoisted(() => ({
  products: { countDocuments: vi.fn(async () => 0), findOne: vi.fn(async (): Promise<unknown> => null), insertOne: vi.fn(async () => undefined) },
  saveImageUpload: vi.fn(async () => ({ ok: true, data: { id: "img", url: "/media/img", size: 10 } })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ products: hoisted.products })) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));
vi.mock("@/lib/media/uploads", () => ({ saveImageUpload: hoisted.saveImageUpload }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { fetchGumroadCandidates, GumroadError } from "@/lib/imports/gumroad";
import { importDraftProducts } from "@/lib/imports/queries";
import { fromCsvRow, fromGumroad, guessProductColumn, htmlToText, isGumroadImage, titleKey, type ImportCandidate } from "@/lib/imports/rules";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const gumroad = { id: "A-m3CDDC5dlrSdKZp0RFhA==", name: "Pencil Icon PSD", description: "<p>I made this <b>for fun</b>.</p><ul><li>One PSD</li></ul>", price: 1900, currency: "usd", thumbnail_url: "https://public-files.gumroad.com/x/y", published: true, deleted: false, is_tiered_membership: false };

describe("import rules", () => {
  it("turns Gumroad HTML into clean text", () => {
    expect(htmlToText(gumroad.description)).toBe("I made this for fun.\n• One PSD");
    expect(htmlToText("Tom &amp; Jerry&nbsp;&lt;3")).toBe("Tom & Jerry <3");
  });

  it("maps a Gumroad product, keeping the price only in the store's own currency", () => {
    expect(fromGumroad(gumroad, "usd")).toMatchObject({ source: "gumroad", externalId: gumroad.id, title: "Pencil Icon PSD", priceCents: 1900, priceNote: null, coverSourceUrl: gumroad.thumbnail_url, wasPublished: true, skipReason: null });
    expect(fromGumroad(gumroad, "eur")).toMatchObject({ priceCents: null, priceNote: expect.stringContaining("USD") });
    expect(fromGumroad({ ...gumroad, is_tiered_membership: true }, "usd")?.skipReason).toMatch(/Memberships/);
    expect(fromGumroad({ ...gumroad, deleted: true }, "usd")).toBeNull();
  });

  it("copies covers only from Gumroad's own https hosts", () => {
    expect(isGumroadImage("https://public-files.gumroad.com/a")).toBe(true);
    expect(isGumroadImage("http://public-files.gumroad.com/a")).toBe(false);
    expect(isGumroadImage("https://gumroad.com.evil.test/a")).toBe(false);
    expect(isGumroadImage("https://169.254.169.254/latest")).toBe(false);
    expect(fromGumroad({ ...gumroad, thumbnail_url: "https://evil.test/a.png" }, "usd")?.coverSourceUrl).toBeNull();
  });

  it("maps CSV rows in the store currency, guesses columns, and keys titles stably", () => {
    expect(guessProductColumn(["Name", "Price", "Details"], "title")).toBe(0);
    expect(guessProductColumn(["Name", "Price", "Details"], "description")).toBe(2);
    expect(fromCsvRow(["Guide", "19.99", "Nice"], { title: 0, price: 1, description: 2 }, "usd")).toMatchObject({ title: "Guide", priceCents: 1999, description: "Nice" });
    expect(fromCsvRow(["Guide", "abc", ""], { title: 0, price: 1, description: 2 }, "usd")).toMatchObject({ priceCents: null, priceNote: expect.any(String) });
    expect(fromCsvRow(["  ", "5", ""], { title: 0, price: 1, description: 2 }, "usd")).toEqual({ error: "No title" });
    expect(fromCsvRow(["<script>x</script>Guide", "5", ""], { title: 0, price: 1, description: -1 }, "usd")).toMatchObject({ title: "xGuide" });
    expect(titleKey("My Guide")).toBe(titleKey("  my guide "));
    expect(titleKey("My Guide")).not.toBe(titleKey("My Guide 2"));
  });
});

describe("fetchGumroadCandidates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Gumroad with the token and maps the products", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, products: [gumroad] }));
    const items = await fetchGumroadCandidates("t".repeat(30), "usd");
    expect(items).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.origin + url.pathname).toBe("https://api.gumroad.com/v2/products");
  });

  it("tells a bad token apart from Gumroad being down", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, message: "bad" }, 401));
    await expect(fetchGumroadCandidates("t".repeat(30), "usd")).rejects.toMatchObject({ kind: "bad_token" });
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(fetchGumroadCandidates("t".repeat(30), "usd")).rejects.toBeInstanceOf(GumroadError);
  });
});

describe("importDraftProducts", () => {
  const candidate = (overrides: Partial<ImportCandidate> = {}): ImportCandidate => ({
    source: "csv",
    externalId: "csv-1",
    title: "Guide",
    description: "Nice",
    priceCents: 1900,
    priceNote: null,
    coverSourceUrl: null,
    wasPublished: false,
    skipReason: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.products.countDocuments.mockResolvedValue(0);
    hoisted.products.findOne.mockResolvedValue(null);
  });

  it("adds drafts without delivery to the session owner's store only", async () => {
    expect(await importDraftProducts("store-a", [candidate()])).toEqual({ added: 1, skipped: 0, limit: false });
    const [doc] = hoisted.products.insertOne.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(doc).toMatchObject({ storeId: "store-a", status: "draft", type: "digital", externalUrl: null, fileId: null, priceCents: 1900, importedFrom: { source: "csv", externalId: "csv-1" } });
    expect(hoisted.products.findOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a" }), expect.anything());
  });

  it("skips what is already imported in this store, memberships, and stops at the product limit", async () => {
    hoisted.products.findOne.mockResolvedValueOnce({ _id: "existing" });
    expect(await importDraftProducts("store-a", [candidate(), candidate({ externalId: "m", skipReason: "Memberships can't be imported yet." })])).toEqual({ added: 0, skipped: 2, limit: false });
    hoisted.products.countDocuments.mockResolvedValue(100);
    expect(await importDraftProducts("store-a", [candidate({ externalId: "new" })])).toMatchObject({ added: 0, limit: true });
  });

  it("copies a Gumroad cover into our own storage for this store", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    await importDraftProducts("store-a", [candidate({ source: "gumroad", externalId: "g1", coverSourceUrl: "https://public-files.gumroad.com/x" })]);
    expect(hoisted.saveImageUpload).toHaveBeenCalledWith("store-a", "cover", expect.any(Uint8Array));
    expect((hoisted.products.insertOne.mock.calls[0] as unknown as [{ coverUrl: string }])[0].coverUrl).toBe("/media/img");
  });
});
