import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ dir: "" }));
const db = vi.hoisted(() => ({
  products: { findOne: vi.fn(), updateOne: vi.fn() },
  files: { insertOne: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn(), find: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get PRODUCT_FILES_DIR() {
      return env.dir;
    },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { openFileForDownload, removeProductFile, saveProductFile } from "@/lib/files/product-files";

const STORE = "store-a";
const PRODUCT = "11111111-2222-4333-8444-555555555555";
const pdf = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("%PDF-1.7 guide"));
      controller.close();
    },
  });

describe("product files (D-050)", () => {
  beforeAll(async () => {
    env.dir = await mkdtemp(path.join(tmpdir(), "pickstall-pf-"));
  });
  afterAll(async () => {
    await rm(env.dir, { recursive: true, force: true });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    db.products.updateOne.mockResolvedValue({ matchedCount: 1 });
    db.files.insertOne.mockResolvedValue({});
    db.files.deleteOne.mockResolvedValue({});
  });

  it("saves only to a product of the session's store, and writes nothing otherwise", async () => {
    db.products.findOne.mockResolvedValue(null);
    const before = await readdir(env.dir);
    expect(await saveProductFile("store-b", PRODUCT, "guide.pdf", pdf())).toMatchObject({ ok: false, status: 404 });
    expect(db.products.findOne).toHaveBeenCalledWith({ _id: PRODUCT, storeId: "store-b", type: { $nin: ["course", "coaching"] } }, expect.anything());
    expect(db.files.insertOne).not.toHaveBeenCalled();
    expect(await readdir(env.dir)).toEqual(before);
  });

  it("stores a valid file with the store id, a clean name and the detected type, and switches to file delivery", async () => {
    db.products.findOne.mockResolvedValue({ _id: PRODUCT, fileId: null });
    const result = await saveProductFile(STORE, PRODUCT, "../Tax guide.PDF", pdf());
    expect(result).toMatchObject({ ok: true, data: { name: "Tax guide.pdf", label: "PDF", size: 14 } });
    expect(db.files.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: STORE, productId: PRODUCT, mime: "application/pdf", ext: "pdf" }));
    expect(db.products.updateOne).toHaveBeenCalledWith({ _id: PRODUCT, storeId: STORE }, { $set: expect.objectContaining({ deliveryType: "file" }) });
  });

  it("refuses a file whose bytes do not match its name, and removes it from disk", async () => {
    db.products.findOne.mockResolvedValue({ _id: PRODUCT, fileId: null });
    const before = (await readdir(env.dir)).length;
    expect(await saveProductFile(STORE, PRODUCT, "guide.pdf", new Response("<html><script>").body!)).toMatchObject({ ok: false, status: 415 });
    expect(db.files.insertOne).not.toHaveBeenCalled();
    expect((await readdir(env.dir)).length).toBe(before);
  });

  it("removes the old file when a new one replaces it", async () => {
    db.products.findOne.mockResolvedValue({ _id: PRODUCT, fileId: "old-file" });
    db.files.findOne.mockResolvedValue({ _id: "old-file", key: "22222222-2222-4333-8444-555555555555", storeId: STORE });
    await saveProductFile(STORE, PRODUCT, "new.pdf", pdf());
    expect(db.files.findOne).toHaveBeenCalledWith({ _id: "old-file", storeId: STORE }, expect.anything());
    expect(db.files.deleteOne).toHaveBeenCalledWith({ _id: "old-file", storeId: STORE });
  });

  it("removes a file only from the store's own product", async () => {
    db.products.findOne.mockResolvedValue(null);
    expect(await removeProductFile("store-b", PRODUCT)).toBe(false);
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });

  it("opens a file for download only through its store", async () => {
    db.files.findOne.mockResolvedValue(null);
    expect(await openFileForDownload("store-b", "file-1")).toBeNull();
    expect(db.files.findOne).toHaveBeenCalledWith({ _id: "file-1", storeId: "store-b" }, expect.anything());
  });
});
