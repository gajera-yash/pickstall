import { handleWebhookRequest } from "@/lib/payments/process";

// Stripe Connect webhook (CLAUDE.md 7): events of creators' connected accounts. Raw body, signature
// verified inside the Stripe adapter with STRIPE_CONNECT_WEBHOOK_SECRET, idempotent by event id,
// answered fast. All real work is in lib/payments/process.ts.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWebhookRequest("stripe", rawBody, request.headers.get("stripe-signature"), "connect");
  return new Response(result.body, { status: result.status });
}
