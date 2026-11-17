import { connection } from "next/server";

import { checkHealth } from "@/lib/health";

// GET /api/health (D-075): 200 when the app and the database answer, 503 otherwise. Point an uptime
// monitor here (docs/OPS_RUNBOOK.md). Never cached.
export async function GET(): Promise<Response> {
  await connection();
  const health = await checkHealth();
  return Response.json(health, { status: health.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
