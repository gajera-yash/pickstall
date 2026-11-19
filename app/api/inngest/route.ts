import { serve } from "inngest/next";
import { NextResponse, type NextRequest } from "next/server";

import { callRemindersFunction } from "@/lib/coaching/reminders";
import { pendingUploadsCleanupFunction } from "@/lib/files/cleanup-job";
import { broadcastSendFunction } from "@/lib/broadcasts/job";
import { inngest } from "@/lib/inngest/client";
import { serverEnv } from "@/lib/env.server";

// Inngest calls this route to run background functions (D-085: call reminders; D-093: daily clean-up of unfinished uploads; D-095: broadcasts). The SDK checks Inngest's request
// signature with INNGEST_SIGNING_KEY in production; there is no app session here by design. Without
// a signing key (or the local dev server, INNGEST_DEV) the route answers 503 instead of running.
const handler = serve({ client: inngest, functions: [callRemindersFunction, pendingUploadsCleanupFunction, broadcastSendFunction] });

function configured(): boolean {
  return Boolean(serverEnv.INNGEST_SIGNING_KEY) || (process.env.NODE_ENV !== "production" && Boolean(process.env.INNGEST_DEV));
}

const notConfigured = () => new NextResponse("Background jobs are not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest, context: unknown) {
  return configured() ? handler.GET(request, context) : notConfigured();
}

export async function POST(request: NextRequest, context: unknown) {
  return configured() ? handler.POST(request, context) : notConfigured();
}

export async function PUT(request: NextRequest, context: unknown) {
  return configured() ? handler.PUT(request, context) : notConfigured();
}
