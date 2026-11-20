import { NextResponse, type NextRequest } from "next/server";

import { verifyLicense } from "@/lib/licenses/queries";
import { verifyLicenseInput } from "@/lib/licenses/rules";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";

// License key check for creators' software (D-114):
//   POST /api/licenses/verify  {"store": "<username>", "key": "ABCDE-FGHJK-MNPQR-STVWX"}
//   -> {"valid": true, "product": "<title>"} or {"valid": false, "reason": "not_found" | "revoked" | "refunded"}
// Open to any origin (software and websites call it), with no cookies. It never returns anything
// about the buyer, and tries are limited per network address so keys cannot be guessed.

const LIMIT = { max: 60, windowMinutes: 10 } as const;
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 1000) return NextResponse.json({ error: "Request too large." }, { status: 413, headers: HEADERS });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Send JSON with store and key." }, { status: 400, headers: HEADERS });
  }
  const parsed = verifyLicenseInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Send JSON with store and key." }, { status: 400, headers: HEADERS });

  try {
    const ipHash = await getClientIpHash();
    if (ipHash && !(await takeRateLimit(rateLimitKey("license-verify:ip", ipHash), LIMIT.max, LIMIT.windowMinutes))) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { ...HEADERS, "Retry-After": String(LIMIT.windowMinutes * 60) } });
    }
    return NextResponse.json(await verifyLicense(parsed.data.store, parsed.data.key), { headers: HEADERS });
  } catch (error) {
    logger.error("licenses.verify_failed", { name: error instanceof Error ? error.name : undefined });
    return NextResponse.json({ error: "Couldn't check the key. Try again." }, { status: 500, headers: HEADERS });
  }
}
