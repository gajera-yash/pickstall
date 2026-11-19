import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ stores: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { StorePixels } from "@/components/store/store-pixels";
import { can, type StoreAccess } from "@/lib/plans/access";
import { findPixelSettings, savePixelSettings } from "@/lib/pixels/queries";
import { hasPixels, pixelValue, pixelsInput, safePixels } from "@/lib/pixels/rules";

describe("pixel IDs (D-097)", () => {
  it("accepts the vendors' ID shapes, trims and upper-cases, and treats empty as none", () => {
    expect(pixelsInput.parse({ metaPixelId: " 1234567890123 ", googleTagId: "g-abc123xyz" })).toEqual({ metaPixelId: "1234567890123", googleTagId: "G-ABC123XYZ" });
    expect(pixelsInput.parse({ metaPixelId: "", googleTagId: "AW-123456789" })).toEqual({ metaPixelId: null, googleTagId: "AW-123456789" });
  });

  it("refuses anything that could carry script or markup", () => {
    for (const metaPixelId of ["123');alert(1)//", "<script>", "12ab34", "1".repeat(25)]) expect(pixelsInput.safeParse({ metaPixelId, googleTagId: "" }).success).toBe(false);
    for (const googleTagId of ["G-ABC\"><img>", "UA-12345-1", "G-", "javascript:alert(1)"]) expect(pixelsInput.safeParse({ metaPixelId: "", googleTagId }).success).toBe(false);
  });

  it("passes only well-formed stored IDs to a page", () => {
    expect(safePixels({ metaPixelId: "123456789", googleTagId: "bad id" })).toEqual({ metaPixelId: "123456789", googleTagId: null });
    expect(safePixels({ metaPixelId: null, googleTagId: null })).toBeNull();
    expect(safePixels(undefined)).toBeNull();
    expect(hasPixels({ metaPixelId: null, googleTagId: "G-ABCD1234" })).toBe(true);
  });

  it("turns integer cents into the main unit, keeping zero-decimal currencies whole", () => {
    expect(pixelValue(1999, 2)).toBe(19.99);
    expect(pixelValue(1500, 0)).toBe(1500);
  });

  it("is off while the store is paused", () => {
    const access = (state: StoreAccess["state"]): StoreAccess => ({ state, endsAt: null, daysLeft: null, plan: null, cancelsAtPeriodEnd: false });
    expect(can(access("trial"), "pixels")).toBe(true);
    expect(can(access("paused"), "pixels")).toBe(false);
  });

  it("renders nothing on the server: no pixel script before the visitor chooses", () => {
    const html = renderToStaticMarkup(createElement(StorePixels, { storeId: "s1", storeName: "Maya", pixels: { metaPixelId: "123456789", googleTagId: "G-ABCD1234" } }));
    expect(html).toBe("");
  });
});

describe("pixel settings are scoped to the session's store (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads and saves only the given store", async () => {
    db.stores.findOne.mockResolvedValue(null);
    expect(await findPixelSettings("store-b")).toEqual({ metaPixelId: null, googleTagId: null });
    expect(db.stores.findOne).toHaveBeenCalledWith({ _id: "store-b" }, expect.anything());
    await savePixelSettings("store-b", { metaPixelId: "123456789", googleTagId: null });
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: "store-b" }, { $set: { pixels: { metaPixelId: "123456789", googleTagId: null } } });
  });
});
