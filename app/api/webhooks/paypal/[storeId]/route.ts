import { handleWebhookRequest } from "@/lib/payments/process";

// PayPal webhook for ONE creator's own PayPal app (D-118): their buyers' payments and refunds. The
// store id in the path picks the app; the delivery is verified with that app's credentials and the
// webhook id we registered on it, so another app cannot speak for this store. Idempotent by event
// id; all real work is in lib/payments/process.ts.
export async function POST(request: Request, { params }: RouteContext<"/api/webhooks/paypal/[storeId]">) {
  const { storeId } = await params;
  const rawBody = await request.text();
  const result = await handleWebhookRequest("paypal", rawBody, null, "connect", { headers: request.headers, accountId: storeId });
  return new Response(result.body, { status: result.status });
}
