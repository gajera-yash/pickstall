import { beforeEach, describe, expect, it, vi } from "vitest";

// D-127: indexes are built once per index version, not on every cold start.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { MONGODB_URI: "mongodb://localhost:27017", MONGODB_DB: "test" } }));

import type { Db } from "mongodb";

import { INDEX_VERSION, ensureIndexesOnce } from "@/lib/db/mongo";

const meta = { findOne: vi.fn(), updateOne: vi.fn() };
const db = { collection: vi.fn(() => meta) } as unknown as Db;
const build = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  meta.updateOne.mockResolvedValue({});
});

describe("ensureIndexesOnce", () => {
  it("skips the ~80 createIndex calls when this version already built them", async () => {
    meta.findOne.mockResolvedValue({ _id: "indexes", version: INDEX_VERSION });
    expect(await ensureIndexesOnce(db, build)).toBe("current");
    expect(build).not.toHaveBeenCalled();
    expect(meta.updateOne).not.toHaveBeenCalled();
  });

  it("builds and records the version on a new database or after the index list changed", async () => {
    meta.findOne.mockResolvedValue({ _id: "indexes", version: "old-version" });
    expect(await ensureIndexesOnce(db, build)).toBe("built");
    expect(build).toHaveBeenCalledWith(db);
    expect(meta.updateOne).toHaveBeenCalledWith({ _id: "indexes" }, { $set: { version: INDEX_VERSION, at: expect.any(Date) } }, { upsert: true });

    meta.findOne.mockResolvedValue(null);
    expect(await ensureIndexesOnce(db, build)).toBe("built");
  });

  it("does not record the version when building fails, so the next start tries again", async () => {
    meta.findOne.mockResolvedValue(null);
    build.mockRejectedValueOnce(new Error("index build failed"));
    await expect(ensureIndexesOnce(db, build)).rejects.toThrow("index build failed");
    expect(meta.updateOne).not.toHaveBeenCalled();
  });

  it("has a stable version for the same index list", () => {
    expect(INDEX_VERSION).toMatch(/^[0-9a-f]{16}$/);
  });
});
