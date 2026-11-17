import { beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteImageUrl, isUuid, mediaIdFromPath, safeImageSrc, sniffImageType } from "@/lib/media/media";
import { imageField } from "@/lib/stores/schemas";

const ID = "11111111-2222-4333-8444-555555555555";

describe("sniffImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it("recognises JPEG, PNG, GIF and WebP by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });

  it("rejects SVG, HTML, scripts and empty files, whatever the extension says", () => {
    const text = (value: string) => new TextEncoder().encode(value);
    expect(sniffImageType(text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImageType(text("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImageType(text("GIF89"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("image sources", () => {
  it("accepts an uploaded image path and an https link only", () => {
    expect(safeImageSrc(`/media/${ID}`)).toBe(`/media/${ID}`);
    expect(safeImageSrc("https://img.example.com/a.png")).toBe("https://img.example.com/a.png");
  });

  it.each(["http://img.example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "/media/../etc/passwd", "/media/not-a-uuid", `//evil.test/media/${ID}`, "https://u:p@x.example.com/a.png", "", null, undefined])(
    "refuses %j",
    (value) => {
      expect(safeImageSrc(value as string | null)).toBeNull();
    },
  );

  it("makes absolute URLs for share previews", () => {
    expect(absoluteImageUrl(`/media/${ID}`, "https://pickstall.store")).toBe(`https://pickstall.store/media/${ID}`);
    expect(absoluteImageUrl("https://img.example.com/a.png", "https://pickstall.store")).toBe("https://img.example.com/a.png");
    expect(absoluteImageUrl("javascript:1", "https://pickstall.store")).toBeUndefined();
  });

  it("reads upload ids and uuids strictly", () => {
    expect(mediaIdFromPath(`/media/${ID}`)).toBe(ID);
    expect(mediaIdFromPath(`/media/${ID}/x`)).toBeNull();
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("../x")).toBe(false);
  });

  it("validates the form field", () => {
    expect(imageField("Photo").parse(`/media/${ID}`)).toBe(`/media/${ID}`);
    expect(imageField("Photo").parse("  ")).toBeUndefined();
    expect(imageField("Photo").safeParse("http://x.example.com/a.png").success).toBe(false);
    expect(imageField("Photo").safeParse("/etc/passwd").success).toBe(false);
  });
});

const store = vi.hoisted(() => ({ put: vi.fn(), remove: vi.fn(), insertOne: vi.fn(), used: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/media/storage", () => ({ storage: { put: store.put, remove: store.remove, get: vi.fn() } }));
vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({ uploads: { insertOne: store.insertOne, aggregate: () => ({ toArray: async () => (store.used ? [{ total: store.used }] : []) }), find: () => ({ toArray: async () => [] }) }, stores: { findOne: async () => null }, products: { find: () => ({ toArray: async () => [] }) } })),
}));

import { saveImageUpload } from "@/lib/media/uploads";

describe("saveImageUpload", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();
    store.put.mockResolvedValue(undefined);
    store.insertOne.mockResolvedValue({});
    store.used = 0;
  });

  it("stores a real image under a new uuid name for the given store", async () => {
    const result = await saveImageUpload("store-1", "avatar", png);
    expect(result.ok).toBe(true);
    expect(store.put).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}\.png$/), png, "store-1");
    expect(store.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1", kind: "avatar", mime: "image/png", size: png.length }));
    if (result.ok) expect(result.data.url).toMatch(/^\/media\/[0-9a-f-]{36}$/);
  });

  it("rejects non-images, empty and oversized files before saving anything", async () => {
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    expect(await saveImageUpload("store-1", "cover", svg)).toMatchObject({ ok: false, status: 415 });
    expect(await saveImageUpload("store-1", "cover", new Uint8Array())).toMatchObject({ ok: false, status: 400 });
    expect(await saveImageUpload("store-1", "cover", new Uint8Array(4 * 1024 * 1024 + 1))).toMatchObject({ ok: false, status: 413 });
    expect(store.put).not.toHaveBeenCalled();
  });

  it("refuses an image once the store's image space is full (D-077)", async () => {
    store.used = 60 * 1024 * 1024 - 5;
    expect(await saveImageUpload("store-1", "avatar", png)).toMatchObject({ ok: false, status: 413 });
    expect(store.put).not.toHaveBeenCalled();
  });

  it("removes the file again if the record cannot be saved", async () => {
    store.insertOne.mockRejectedValue(new Error("db down"));
    await expect(saveImageUpload("store-1", "avatar", png)).rejects.toThrow();
    expect(store.remove).toHaveBeenCalled();
  });
});
