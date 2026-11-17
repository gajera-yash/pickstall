import "server-only";

import { getDb } from "@/lib/db/mongo";

// Health check (D-075) for an uptime monitor: is the app up, and can it reach the database?
// The answer carries no versions, hosts or error text.

export const HEALTH_DB_TIMEOUT_MS = 3_000;

export type Health = { status: "ok" | "degraded"; database: "ok" | "unreachable" };

export async function checkHealth(ping: () => Promise<unknown> = pingDatabase, timeoutMs = HEALTH_DB_TIMEOUT_MS): Promise<Health> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    await Promise.race([ping(), timeout]);
    return { status: "ok", database: "ok" };
  } catch {
    return { status: "degraded", database: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function pingDatabase(): Promise<unknown> {
  const db = await getDb();
  return db.command({ ping: 1 });
}
