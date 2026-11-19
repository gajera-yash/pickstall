import { NextResponse, type NextRequest } from "next/server";

import { handleResendWebhook } from "@/lib/subscribers/resend-webhook";

// Resend webhook (D-095): bounces and spam complaints of list emails. Svix-signed; see
// lib/subscribers/resend-webhook.ts.
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const result = await handleResendWebhook(payload, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  return new NextResponse(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
