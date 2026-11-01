import { createServer } from "node:net";

import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, describe, expect, it, vi } from "vitest";

// D-041: when MongoDB cannot be reached (Atlas not allowing this IP, network down), the app must
// recover by itself once the database is back, without restarting the server. Before the fix the
// driver kept a closed topology and every later query failed with MongoTopologyClosedError.

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

let mongo: MongoMemoryServer | undefined;

afterAll(async () => {
  await mongo?.stop();
});

describe("database outage", () => {
  it("reconnects on the next request once the database is back", async () => {
    const port = await freePort();
    // Point a fresh copy of lib/db/mongo at a port where nothing listens yet.
    const globals = globalThis as { pickstallMongo?: { close(): Promise<void> }; pickstallIndexes?: unknown };
    await globals.pickstallMongo?.close();
    globals.pickstallMongo = undefined;
    globals.pickstallIndexes = undefined;
    process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/?serverSelectionTimeoutMS=1500&directConnection=true`;
    vi.resetModules();
    const { getDb } = await import("@/lib/db/mongo");

    await expect(getDb()).rejects.toThrow();
    await expect(getDb()).rejects.toThrow(); // still down, and still not stuck on a closed client

    mongo = await MongoMemoryServer.create({ instance: { port, args: ["--wiredTigerCacheSizeGB", "0.25"] } });
    const db = await getDb();
    expect(await db.command({ ping: 1 })).toMatchObject({ ok: 1 });
  }, 60_000);
});
