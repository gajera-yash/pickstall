import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

// Audit log on a real MongoDB (D-075): each person sees only their own activity, newest first, and a
// failed write never breaks the action being recorded.

import { listOwnAudit, recordAudit } from "@/lib/audit/log";
import { collections } from "@/lib/db/collections";

describe("audit log", () => {
  it("lists only the owner's own records, newest first, without ip hashes", async () => {
    const maya = randomUUID();
    const other = randomUUID();
    await recordAudit({ actorId: maya, action: "auth.signed_in", ipHash: "hash-1" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await recordAudit({ actorId: maya, storeId: "store-1", action: "store.username_changed", meta: { username: "maya" } });
    await recordAudit({ actorId: other, action: "account.data_exported" });

    const mine = await listOwnAudit(maya);
    expect(mine.map((entry) => entry.action)).toEqual(["store.username_changed", "auth.signed_in"]);
    expect(mine[0]?.meta).toEqual({ username: "maya" });
    expect(JSON.stringify(mine)).not.toContain("hash-1");
    expect((await listOwnAudit(other)).map((entry) => entry.action)).toEqual(["account.data_exported"]);
  });

  it("respects the limit", async () => {
    const actorId = randomUUID();
    for (let index = 0; index < 4; index += 1) await recordAudit({ actorId, action: "auth.signed_in" });
    expect(await listOwnAudit(actorId, 3)).toHaveLength(3);
  });

  it("never throws when the write fails", async () => {
    const { auditLogs } = await collections();
    const spy = vi.spyOn(auditLogs.constructor.prototype, "insertOne").mockRejectedValueOnce(new Error("db down"));
    await expect(recordAudit({ actorId: randomUUID(), action: "auth.signed_in" })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("has the owner index and a TTL so old records expire", async () => {
    const { auditLogs } = await collections();
    const indexes = await auditLogs.indexes();
    expect(indexes.find((index) => index.name === "audit_actor_at")?.key).toEqual({ actorId: 1, at: -1 });
    expect(indexes.find((index) => index.name === "audit_ttl")?.expireAfterSeconds).toBe(400 * 24 * 60 * 60);
  });
});
