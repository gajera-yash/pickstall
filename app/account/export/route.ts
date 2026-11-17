import { NextResponse, type NextRequest } from "next/server";

import { exportUserData } from "@/lib/account/export";
import { recordAudit } from "@/lib/audit/log";
import { appOriginFrom } from "@/lib/app-origin";
import { getCurrentUser } from "@/lib/auth/guards";
import { loginPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

// "Download my data" (D-074). Thin: the signed-in user, a rate limit, then lib/account/export.ts.
// Works for creators and for buyers without a store.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(loginPath("/dashboard/settings/account"), appOriginFrom(request.headers)));
  if (!(await takeRateLimit(rateLimitKey("data-export:user", user.id), 5, 60))) {
    return new NextResponse("Too many downloads. Please try again in an hour.", { status: 429 });
  }
  try {
    const data = await exportUserData(user);
    await recordAudit({ actorId: user.id, action: "account.data_exported" });
    const day = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pickstall-data-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("account.export_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't prepare your data. Please try again.", { status: 500 });
  }
}
