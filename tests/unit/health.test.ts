import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/mongo", () => ({ getDb: vi.fn() }));

import { checkHealth } from "@/lib/health";

// /api/health (D-075): says only "ok" or "degraded", never why.

describe("checkHealth", () => {
  it("is ok when the database answers", async () => {
    expect(await checkHealth(async () => ({ ok: 1 }))).toEqual({ status: "ok", database: "ok" });
  });

  it("is degraded, with no error text, when the database fails", async () => {
    const health = await checkHealth(async () => {
      throw new Error("connection refused at mongodb+srv://user:pass@host");
    });
    expect(health).toEqual({ status: "degraded", database: "unreachable" });
    expect(JSON.stringify(health)).not.toContain("mongodb");
  });

  it("does not wait forever for a database that hangs", async () => {
    const started = Date.now();
    expect(await checkHealth(() => new Promise(() => undefined), 50)).toEqual({ status: "degraded", database: "unreachable" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
