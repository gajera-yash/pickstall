import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = vi.hoisted(() => ({ path: "", r2: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get PRODUCT_FILES_DIR() {
      return dir.path;
    },
    get R2_ACCOUNT_ID() {
      return dir.r2 ? "0123456789abcdef0123456789abcdef" : undefined;
    },
    get R2_ACCESS_KEY_ID() {
      return dir.r2 ? "access-key-id-0001" : undefined;
    },
    get R2_SECRET_ACCESS_KEY() {
      return dir.r2 ? "secret-access-key-secret-access-key-0001" : undefined;
    },
    get R2_BUCKET() {
      return dir.r2 ? "pickstall-files" : undefined;
    },
  },
}));

import { activeStorage, fileStorageAvailable, readFileStream, removeFile, writeFileStream } from "@/lib/files/storage";

const KEY = "11111111-2222-4333-8444-555555555555";

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

describe("private product file storage (D-050)", () => {
  beforeAll(async () => {
    dir.path = await mkdtemp(path.join(tmpdir(), "pickstall-files-"));
  });
  afterAll(async () => {
    await rm(dir.path, { recursive: true, force: true });
  });

  it("streams a file to disk and reads it back, keeping the first bytes for the type check", async () => {
    const result = await writeFileStream(KEY, streamOf(new TextEncoder().encode("%PDF-1.7 "), new TextEncoder().encode("hello")), 1000);
    expect(result).toMatchObject({ ok: true, size: 14 });
    if (result.ok) expect(new TextDecoder().decode(result.head)).toBe("%PDF-1.7 hello");
    const file = await readFileStream(KEY);
    expect(file?.size).toBe(14);
    expect(await text(file!.stream)).toBe("%PDF-1.7 hello");
  });

  it("stops at the size limit and leaves nothing behind", async () => {
    const key = "22222222-2222-4333-8444-555555555555";
    const result = await writeFileStream(key, streamOf(new Uint8Array(600), new Uint8Array(600)), 1000);
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(await readFileStream(key)).toBeNull();
    expect((await readdir(dir.path)).some((name) => name.startsWith(key))).toBe(false);
  });

  it("refuses an empty upload", async () => {
    const key = "33333333-2222-4333-8444-555555555555";
    expect(await writeFileStream(key, streamOf(), 1000)).toEqual({ ok: false, reason: "empty" });
    expect(await readFileStream(key)).toBeNull();
  });

  it("only accepts server-made uuid keys, so no path can be smuggled in", async () => {
    await expect(writeFileStream("../escape", streamOf(new Uint8Array(1)), 1000)).rejects.toThrow("Invalid file key.");
    await expect(readFileStream("../../etc/passwd")).rejects.toThrow("Invalid file key.");
  });

  it("reads a missing file as null and removes files", async () => {
    expect(await readFileStream("44444444-2222-4333-8444-555555555555")).toBeNull();
    await removeFile(KEY);
    expect(await readFileStream(KEY)).toBeNull();
  });
});

describe("fileStorageAvailable (D-077)", () => {
  it("is on in development, and in production only with a lasting PRODUCT_FILES_DIR", () => {
    const saved = dir.path;
    vi.stubEnv("NODE_ENV", "development");
    dir.path = "";
    expect(fileStorageAvailable()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(fileStorageAvailable()).toBe(false);
    dir.path = "/srv/pickstall/files";
    expect(fileStorageAvailable()).toBe(true);
    vi.unstubAllEnvs();
    dir.path = saved;
  });
});

describe("activeStorage (D-093)", () => {
  it("uses R2 whenever it is configured, also in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const saved = dir.path;
    dir.path = "";
    expect(activeStorage()).toBeNull();
    dir.r2 = true;
    expect(activeStorage()).toBe("r2");
    expect(fileStorageAvailable()).toBe(true);
    dir.r2 = false;
    dir.path = saved;
    vi.unstubAllEnvs();
  });
});
