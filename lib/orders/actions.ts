"use server";

import { randomUUID } from "node:crypto";

import { redirect, unstable_rethrow } from "next/navigation";

import { appOrigin } from "@/lib/app-origin";
import { CHECKOUT_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { validateAnswers } from "@/lib/orders/answers";
import { orderAmounts } from "@/lib/orders/pricing";
import {
  attachProviderSession,
  canBuy,
  createPendingOrder,
  findPendingMockOrder,
  loadCheckoutContext,
  markOrderFailed,
  productPathForOrder,
} from "@/lib/orders/queries";
import { buyerInput } from "@/lib/orders/schemas";
import { providerForStore } from "@/lib/payments";
import { mockAllowed, signMockBody } from "@/lib/payments/mock";
import { handleWebhookRequest, markFreeOrderPaid } from "@/lib/payments/process";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, type Result } from "@/lib/result";
import { isUuid } from "@/lib/media/media";

export type CheckoutState = Result<never> | null;

const GENERIC = "Couldn't start your checkout. Check your connection and try again.";

/** Answers arrive as `answer-<questionId>` form fields. */
function answersFromForm(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer-") && typeof value === "string") raw[key.slice("answer-".length)] = value;
  }
  return raw;
}

/**
 * Starts a checkout (PRD F4). Everything that matters is decided here on the server: the store and
 * product must be published, the amount comes from the product (its price, or its discounted price,
 * D-047), answers are checked against the product's own questions, and the order is
 * created before the provider is asked for a payment page. A client price is never trusted.
 */
export async function startCheckout(username: string, productSlug: string, _prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = buyerInput.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(issue?.message ?? "Check the form and try again.", typeof issue?.path[0] === "string" ? issue.path[0] : undefined);
  }
  const buyer = parsed.data;

  try {
    const { max, windowMinutes } = CHECKOUT_RATE_LIMIT;
    const ipHash = await getClientIpHash();
    const allowedByIp = ipHash ? await takeRateLimit(rateLimitKey("checkout:ip", ipHash), max, windowMinutes) : true;
    const allowedByEmail = await takeRateLimit(rateLimitKey("checkout:email", buyer.email), max, windowMinutes);
    if (!allowedByIp || !allowedByEmail) return err("Too many attempts. Wait a few minutes, then try again.");

    const context = await loadCheckoutContext(username, productSlug);
    if (!context) return err("This product isn't available anymore.");

    // The price comes from the product in the database, never from the form (CLAUDE.md 7, D-047).
    const amount = orderAmounts(context.product);

    const answers = validateAnswers(context.product.checkout.questions, answersFromForm(formData));
    if (!answers.ok) return err(answers.error, `answer-${answers.questionId}`);

    const free = amount.totalCents === 0;
    const provider = free ? null : providerForStore(context.store);
    if (!free && !provider) return err("Payments aren't set up for this store yet. Please check back soon.");
    if (!free && !canBuy(context)) return err("Payments aren't set up for this store yet. Please check back soon.");

    const orderId = await createPendingOrder({
      storeId: context.store._id,
      productId: context.product.id,
      item: { title: context.product.title, unitPriceCents: amount.subtotalCents },
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      buyerPhone: buyer.phone ?? null,
      answers: answers.answers,
      subtotalCents: amount.subtotalCents,
      discountCents: amount.discountCents,
      totalCents: amount.totalCents,
      currency: context.store.currency,
      provider: free ? "free" : provider!.name,
    });

    const base = `/@${context.store.slug}/${context.product.slug}`;
    const appUrl = await appOrigin();

    if (free || !provider) {
      await markFreeOrderPaid(orderId);
    } else {
      try {
        const session = await provider.createCheckout({
          orderId,
          title: context.product.title,
          amountCents: amount.totalCents,
          currency: context.store.currency,
          buyerEmail: buyer.email,
          successUrl: `${appUrl}${base}/thank-you?order=${orderId}`,
          cancelUrl: `${appUrl}${base}`,
          connectedAccountId: context.store.stripeAccountId,
        });
        await attachProviderSession(orderId, session.providerSessionId);
        redirect(session.url);
      } catch (error) {
        unstable_rethrow(error); // redirect() throws a control-flow signal; only real failures continue
        await markOrderFailed(orderId).catch(() => undefined);
        logger.error("checkout.provider_failed", { name: error instanceof Error ? error.name : undefined });
        return err(GENERIC);
      }
    }
    redirect(`${base}/thank-you?order=${orderId}`);
  } catch (error) {
    unstable_rethrow(error);
    logger.error("checkout.failed", { name: error instanceof Error ? error.name : undefined });
    return err(GENERIC);
  }
}

/**
 * Development-only: "pays" a mock order. It sends a signed event through the SAME webhook handler
 * Stripe uses, so the order becomes paid only through the real fulfilment path.
 */
export async function confirmMockPayment(orderId: string): Promise<void> {
  if (!mockAllowed() || !isUuid(orderId)) redirect("/");
  const order = await findPendingMockOrder(orderId);
  if (!order) redirect("/");

  const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.succeeded", orderId: order.id });
  const result = await handleWebhookRequest("mock", body, signMockBody(body));
  const path = await productPathForOrder(order.storeId, order.productId);
  if (result.status !== 200 || !path) redirect("/");
  redirect(`/@${path.username}/${path.productSlug}/thank-you?order=${order.id}`);
}
