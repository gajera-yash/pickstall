import { handleWebhookRequest } from "@/lib/payments/process";

// Stripe Connect webhook (CLAUDE.md 7): raw body, signature verified inside the Stripe adapter,
// idempotent by event id, answered fast. All real work is in lib/payments/process.ts.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWebhookRequest("stripe", rawBody, request.headers.get("stripe-signature"));
  return new Response(result.body, { status: result.status });
}
