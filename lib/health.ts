import "server-only";

import { ensureConnected, mongoDb } from "@/lib/db/mongo";

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

/**
 * Connects and pings, without waiting for the app's index setup (getDb), which can take seconds on
 * the first request after a deploy and made the check report a false "unreachable" (D-090).
 */
async function pingDatabase(): Promise<unknown> {
  await ensureConnected();
  return mongoDb.command({ ping: 1 });
}
