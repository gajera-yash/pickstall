import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ dir: "", r2: false }));
const db = vi.hoisted(() => ({
  products: { findOne: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn(), findOneAndUpdate: vi.fn() },
  lessons: { countDocuments: vi.fn() },
  files: { insertOne: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn() },
}));
const r2 = vi.hoisted(() => ({
  r2Configured: vi.fn(() => env.r2),
  r2UploadUrl: vi.fn(async (key: string) => `https://acct.r2.cloudflarestorage.com/bucket/${key}?X-Amz-Signature=up`),
  r2DownloadUrl: vi.fn(async (key: string) => `https://acct.r2.cloudflarestorage.com/bucket/${key}?X-Amz-Signature=down`),
  inspectR2Object: vi.fn(),
  removeR2Object: vi.fn(async () => undefined),
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
vi.mock("@/lib/files/r2", () => r2);

import { openFileForDownload, removeProductFile } from "@/lib/files/product-files";
import { cleanupPendingUploads, finishFileUpload, startFileUpload, writePendingUpload } from "@/lib/files/uploads";

const STORE = "store-a";
const PRODUCT = "11111111-2222-4333-8444-555555555555";
const KEY = "33333333-2222-4333-8444-555555555555";
const pdfBytes = () => new TextEncoder().encode("%PDF-1.7 guide");
const pdfStream = () => new Response(pdfBytes()).body!;

const pending = (over: Record<string, unknown> = {}) => ({ _id: "file-1", storeId: STORE, productId: PRODUCT, key: KEY, name: "Tax guide.pdf", ext: "pdf", mime: "application/pdf", size: 14, storage: "disk", status: "pending", createdAt: new Date(), ...over });

describe("file uploads (D-093)", () => {
  beforeAll(async () => {
    env.dir = await mkdtemp(path.join(tmpdir(), "pickstall-pf-"));
  });
  afterAll(async () => {
    await rm(env.dir, { recursive: true, force: true });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    env.r2 = false;
    db.products.countDocuments.mockResolvedValue(1);
    db.products.findOneAndUpdate.mockResolvedValue({ _id: PRODUCT, fileId: null });
    db.lessons.countDocuments.mockResolvedValue(1);
    db.files.countDocuments.mockResolvedValue(0);
    db.files.insertOne.mockResolvedValue({});
    db.files.deleteOne.mockResolvedValue({});
    db.files.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  describe("start", () => {
    it("checks the product against the session's store and saves nothing for another store's product", async () => {
      db.products.countDocuments.mockResolvedValue(0);
      expect(await startFileUpload("store-b", { kind: "product", productId: PRODUCT }, "guide.pdf", 14)).toMatchObject({ ok: false, status: 404 });
      expect(db.products.countDocuments).toHaveBeenCalledWith({ _id: PRODUCT, storeId: "store-b", type: { $nin: ["course", "coaching"] } }, expect.anything());
      expect(db.files.insertOne).not.toHaveBeenCalled();
    });

    it("refuses a file type that is not allowed, an empty file and a file over the limit", async () => {
      expect(await startFileUpload(STORE, { kind: "product", productId: PRODUCT }, "run.exe", 14)).toMatchObject({ ok: false, status: 415 });
      expect(await startFileUpload(STORE, { kind: "product", productId: PRODUCT }, "guide.pdf", 0)).toMatchObject({ ok: false, status: 400 });
      expect(await startFileUpload(STORE, { kind: "product", productId: PRODUCT }, "guide.pdf", 500 * 1024 * 1024)).toMatchObject({ ok: false, status: 413 });
      expect(db.files.insertOne).not.toHaveBeenCalled();
    });

    it("saves a pending record with a clean name and the type from the extension; disk uploads go to our own route", async () => {
      const result = await startFileUpload(STORE, { kind: "product", productId: PRODUCT }, "../Tax guide.PDF", 14);
      expect(db.files.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: STORE, productId: PRODUCT, name: "Tax guide.pdf", mime: "application/pdf", status: "pending", storage: "disk" }));
      expect(result).toMatchObject({ ok: true, data: { url: expect.stringMatching(/^\/api\/files\/[0-9a-f-]{36}$/), headers: { "Content-Type": "application/pdf" } } });
    });

    it("hands out a signed R2 link when R2 is configured", async () => {
      env.r2 = true;
      const result = await startFileUpload(STORE, { kind: "product", productId: PRODUCT }, "guide.pdf", 14);
      expect(db.files.insertOne).toHaveBeenCalledWith(expect.objectContaining({ storage: "r2" }));
      expect(r2.r2UploadUrl).toHaveBeenCalledWith(expect.any(String), "application/pdf");
      expect(result).toMatchObject({ ok: true, data: { url: expect.stringContaining("r2.cloudflarestorage.com") } });
    });

    it("keeps a lesson to 5 ready files and checks the lesson's store", async () => {
      db.files.countDocuments.mockResolvedValue(5);
      expect(await startFileUpload(STORE, { kind: "lesson", courseId: PRODUCT, lessonId: "lesson-1" }, "notes.pdf", 14)).toMatchObject({ ok: false, status: 409 });
      expect(db.lessons.countDocuments).toHaveBeenCalledWith({ _id: "lesson-1", storeId: STORE, productId: PRODUCT }, expect.anything());
      expect(db.files.countDocuments).toHaveBeenCalledWith({ storeId: STORE, lessonId: "lesson-1", status: { $ne: "pending" } });
    });
  });

  describe("disk upload body", () => {
    it("only writes a pending disk upload of the session's store", async () => {
      db.files.findOne.mockResolvedValue(null);
      expect(await writePendingUpload("store-b", "file-1", pdfStream())).toMatchObject({ ok: false, status: 404 });
      expect(db.files.findOne).toHaveBeenCalledWith({ _id: "file-1", storeId: "store-b", storage: "disk", status: "pending" }, expect.anything());
    });
  });

  describe("finish", () => {
    it("only finishes a pending upload of the session's store", async () => {
      db.files.findOne.mockResolvedValue(null);
      expect(await finishFileUpload("store-b", "file-1")).toMatchObject({ ok: false, status: 404 });
      expect(db.files.findOne).toHaveBeenCalledWith({ _id: "file-1", storeId: "store-b", status: "pending" });
    });

    it("marks a matching file ready, attaches it and switches the product to file delivery", async () => {
      await writeFile(path.join(env.dir, KEY), pdfBytes());
      db.files.findOne.mockResolvedValueOnce(pending());
      const result = await finishFileUpload(STORE, "file-1");
      expect(result).toMatchObject({ ok: true, data: { id: "file-1", name: "Tax guide.pdf", label: "PDF", size: 14 } });
      expect(db.files.updateOne).toHaveBeenCalledWith({ _id: "file-1", storeId: STORE, status: "pending" }, { $set: { status: "ready", size: 14 } });
      expect(db.products.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT, storeId: STORE }, { $set: expect.objectContaining({ fileId: "file-1", deliveryType: "file" }) }, expect.anything());
    });

    it("refuses bytes that do not match the name and deletes the record and the bytes", async () => {
      await writeFile(path.join(env.dir, KEY), "<html><script>");
      db.files.findOne.mockResolvedValueOnce(pending());
      expect(await finishFileUpload(STORE, "file-1")).toMatchObject({ ok: false, status: 415 });
      expect(db.files.deleteOne).toHaveBeenCalledWith({ _id: "file-1", storeId: STORE });
      expect(db.files.updateOne).not.toHaveBeenCalled();
      expect(await readdir(env.dir)).not.toContain(KEY);
    });

    it("refuses an R2 object over the limit (the signed link cannot cap the size) and deletes it", async () => {
      r2.inspectR2Object.mockResolvedValue({ size: 300 * 1024 * 1024, head: pdfBytes() });
      db.files.findOne.mockResolvedValueOnce(pending({ storage: "r2" }));
      expect(await finishFileUpload(STORE, "file-1")).toMatchObject({ ok: false, status: 413 });
      expect(r2.removeR2Object).toHaveBeenCalledWith(KEY);
    });

    it("says so when the bytes never arrived", async () => {
      r2.inspectR2Object.mockResolvedValue(null);
      db.files.findOne.mockResolvedValueOnce(pending({ storage: "r2" }));
      expect(await finishFileUpload(STORE, "file-1")).toMatchObject({ ok: false, status: 400 });
    });

    it("removes the old file when a new one replaces it", async () => {
      r2.inspectR2Object.mockResolvedValue({ size: 14, head: pdfBytes() });
      db.files.findOne.mockResolvedValueOnce(pending({ storage: "r2" })).mockResolvedValueOnce({ _id: "old-file", key: KEY, storeId: STORE, storage: "r2" });
      db.products.findOneAndUpdate.mockResolvedValue({ _id: PRODUCT, fileId: "old-file" });
      await finishFileUpload(STORE, "file-1");
      expect(db.files.findOne).toHaveBeenLastCalledWith({ _id: "old-file", storeId: STORE }, expect.anything());
      expect(db.files.deleteOne).toHaveBeenCalledWith({ _id: "old-file", storeId: STORE });
    });
  });

  it("cleans up only pending uploads older than a day", async () => {
    const now = new Date("2026-11-19T12:00:00Z");
    const toArray = vi.fn(async () => [{ _id: "file-1", key: KEY, storeId: STORE, storage: "r2" }]);
    db.files.find.mockReturnValue({ limit: () => ({ toArray }) });
    expect(await cleanupPendingUploads(now)).toBe(1);
    expect(db.files.find).toHaveBeenCalledWith({ status: "pending", createdAt: { $lt: new Date("2026-11-18T12:00:00Z") } }, expect.anything());
    expect(r2.removeR2Object).toHaveBeenCalledWith(KEY);
  });
});

describe("product files (D-050)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes a file only from the store's own product", async () => {
    db.products.findOne.mockResolvedValue(null);
    expect(await removeProductFile("store-b", PRODUCT)).toBe(false);
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });

  it("opens a file for download only through its store, never while pending", async () => {
    db.files.findOne.mockResolvedValue(null);
    expect(await openFileForDownload("store-b", "file-1")).toBeNull();
    expect(db.files.findOne).toHaveBeenCalledWith({ _id: "file-1", storeId: "store-b", status: { $ne: "pending" } }, expect.anything());
  });

  it("delivers an R2 file as a short signed link with the download name", async () => {
    db.files.findOne.mockResolvedValue({ _id: "file-1", key: KEY, name: "Tax guide.pdf", mime: "application/pdf", storage: "r2" });
    expect(await openFileForDownload(STORE, "file-1")).toEqual({ kind: "redirect", url: expect.stringContaining("X-Amz-Signature=down") });
    expect(r2.r2DownloadUrl).toHaveBeenCalledWith(KEY, expect.stringContaining('attachment; filename="Tax guide.pdf"'), "application/pdf");
  });
});
