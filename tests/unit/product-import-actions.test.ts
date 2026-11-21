import { beforeEach, describe, expect, it, vi } from "vitest";

// Import actions: the store comes from the session, Gumroad is asked again on import (ids from the
// browser only pick), the token never comes back, and CSV cells are checked again on the server.

const hoisted = vi.hoisted(() => ({
  fetchGumroadCandidates: vi.fn(),
  importDraftProducts: vi.fn(async () => ({ added: 1, skipped: 0, limit: false })),
  takeRateLimit: vi.fn(async () => true),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dashboard/setup-gate", () => ({ requireUnlockedCreator: vi.fn(async () => ({ user: { id: "owner-a" }, store: { id: "store-a", currency: "usd" } })) }));
vi.mock("@/lib/imports/gumroad", () => ({ fetchGumroadCandidates: hoisted.fetchGumroadCandidates, GumroadError: class GumroadError extends Error {} }));
vi.mock("@/lib/imports/queries", () => ({ importDraftProducts: hoisted.importDraftProducts }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (a: string, b: string) => `${a}:${b}`, takeRateLimit: hoisted.takeRateLimit }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { importCsvAction, importGumroadAction, previewGumroadAction } from "@/lib/imports/actions";

const TOKEN = "gumroadtoken_abcdefghijklmnop";
const item = (externalId: string) => ({ source: "gumroad", externalId, title: externalId, description: null, priceCents: 100, priceNote: null, coverSourceUrl: "https://public-files.gumroad.com/c", wasPublished: true, skipReason: null });

describe("product import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.fetchGumroadCandidates.mockResolvedValue([item("g1"), item("g2")]);
  });

  it("previews without returning the token or cover URLs", async () => {
    const result = await previewGumroadAction(TOKEN);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain("public-files.gumroad.com");
    expect(hoisted.fetchGumroadCandidates).toHaveBeenCalledWith(TOKEN, "usd");
  });

  it("imports only the picked products, fetched again, into the session's store", async () => {
    await importGumroadAction(TOKEN, ["g2", "not-on-gumroad"]);
    expect(hoisted.importDraftProducts).toHaveBeenCalledWith("store-a", [expect.objectContaining({ externalId: "g2" })]);
  });

  it("refuses a bad token shape, an empty pick and too many tries", async () => {
    expect(await previewGumroadAction("short")).toMatchObject({ ok: false, field: "token" });
    expect(await importGumroadAction(TOKEN, [])).toMatchObject({ ok: false });
    hoisted.takeRateLimit.mockResolvedValueOnce(false);
    expect(await previewGumroadAction(TOKEN)).toMatchObject({ ok: false });
    expect(hoisted.fetchGumroadCandidates).not.toHaveBeenCalled();
  });

  it("checks CSV rows again on the server and counts rows without a title", async () => {
    const result = await importCsvAction({ rows: [{ title: "Guide", price: "19", description: "" }, { title: " ", price: "5", description: "" }] });
    expect(result).toMatchObject({ ok: true, data: { invalid: 1 } });
    expect(hoisted.importDraftProducts).toHaveBeenCalledWith("store-a", [expect.objectContaining({ title: "Guide", priceCents: 1900, source: "csv" })]);
    expect(await importCsvAction({ rows: [] })).toMatchObject({ ok: false });
  });
});
