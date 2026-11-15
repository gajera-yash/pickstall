import { randomUUID } from "node:crypto";

import { afterAll, inject, vi } from "vitest";

// `connection()` marks request data in Next.js and throws outside a request; tests have no request.
vi.mock("next/server", async () => ({ ...(await vi.importActual<typeof import("next/server")>("next/server")), connection: async () => undefined }));

// Runs before each integration test file imports app code: point the app at the in-memory server
// and give the file its own database, so files never see each other's documents.
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB = `it_${randomUUID().slice(0, 8)}`;
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000";
process.env.BETTER_AUTH_SECRET = "integration-test-secret-0123456789abcdef";

// lib/db/mongo.ts keeps its client and index promise on globalThis; a new database needs its own indexes.
const globals = globalThis as { pickstallIndexes?: unknown; pickstallMongo?: { close(): Promise<void> } };
globals.pickstallIndexes = undefined;

afterAll(async () => {
  await globals.pickstallMongo?.close();
  globals.pickstallMongo = undefined;
});
