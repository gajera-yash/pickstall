import { handleBunnyWebhook } from "@/lib/courses/bunny-webhook";

// Bunny Stream webhook (D-055): raw body bytes (the signature covers them exactly), verified and
// idempotent inside lib/courses/bunny-webhook.ts, answered fast.
export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const result = await handleBunnyWebhook(rawBody, request.headers.get("x-bunnystream-signature"));
  return new Response(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
