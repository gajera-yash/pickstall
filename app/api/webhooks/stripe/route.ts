import { handleWebhookRequest } from "@/lib/payments/process";

// Stripe webhook for events of our OWN account (D-053): the test seller shortcut (D-034) today,
// Billing later. Its own signing secret, STRIPE_PLATFORM_WEBHOOK_SECRET (CLAUDE.md 7).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWebhookRequest("stripe", rawBody, request.headers.get("stripe-signature"), "platform");
  return new Response(result.body, { status: result.status });
}
