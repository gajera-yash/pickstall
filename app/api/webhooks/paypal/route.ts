import { handleWebhookRequest } from "@/lib/payments/process";

// PayPal webhook for events of our OWN app (D-118): platform billing (Pickstall plan subscriptions).
// Verified with PayPal's verify-webhook-signature API for PAYPAL_WEBHOOK_ID, idempotent by event id.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWebhookRequest("paypal", rawBody, null, "platform", { headers: request.headers });
  return new Response(result.body, { status: result.status });
}
