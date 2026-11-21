"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { appOrigin } from "@/lib/app-origin";
import { requireCreator } from "@/lib/auth/guards";
import { CHECKOUT_RATE_LIMIT, PRODUCT_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { attachProviderSession, createPendingOrder, loadCheckoutContext, markOrderFailed, originOfOrder } from "@/lib/orders/queries";
import { providerForStore, sellerAccountFor } from "@/lib/payments";
import { markFreeOrderPaid } from "@/lib/payments/process";
import { productIdInput } from "@/lib/products/schemas";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";
import { findUpsellOffer, saveProductUpsell } from "@/lib/upsells/queries";
import { OFFER_KINDS, upsellInputFor, type OfferKind } from "@/lib/upsells/rules";

/** Saves the upsell (D-099) or the downsell (D-115) of one product of the session owner's store. */
export async function saveUpsellAction(productId: string, input: unknown, kind: unknown = "upsell"): Promise<Result<{ enabled: boolean }>> {
  const { user, store } = await requireCreator(`/dashboard/products/${productId}`);
  if (!productIdInput.safeParse(productId).success || !OFFER_KINDS.includes(kind as OfferKind)) return err("We couldn't find that product.");
  const parsed = upsellInputFor(store.currency).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the upsell and try again.", typeof field === "string" ? field : undefined);
  }
  const { max, windowMinutes } = PRODUCT_RATE_LIMIT;
  if (!(await takeRateLimit(rateLimitKey("product-write:owner", user.id), max, windowMinutes))) return err("Slow down a little, then try again.");
  try {
    const result = await saveProductUpsell(store.id, productId, parsed.data, kind as OfferKind);
    if (result === "not_found") return err("We couldn't find that product.");
    if (result === "bad_product") return err("Pick another digital product or course from your store.", "productId");
  } catch (error) {
    logger.error("upsells.save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the upsell. Try again.");
  }
  revalidatePath("/dashboard", "layout");
  return ok({ enabled: parsed.data !== null });
}

export type UpsellState = Result<never> | null;
const GENERIC = "Couldn't add it. Check your connection and try again.";

/**
 * "Yes, add it" on the thank-you page (D-099). Everything is decided on the server: the paid order
 * must belong to this store and still qualify for the offer, the price is the one saved on the
 * product, and the buyer's details come from the paid order. It then goes through the same order
 * and payment path as any checkout (a free offer is marked paid like any free order).
 */
export async function startUpsellCheckout(username: string, productSlug: string, orderId: string, kind: unknown = "upsell"): Promise<UpsellState> {
  if (!isUuid(orderId) || !OFFER_KINDS.includes(kind as OfferKind)) return err("This offer isn't available anymore.");
  const offerKind = kind as OfferKind;
  try {
    const ipHash = await getClientIpHash();
    const { max, windowMinutes } = CHECKOUT_RATE_LIMIT;
    if (ipHash && !(await takeRateLimit(rateLimitKey("checkout:ip", ipHash), max, windowMinutes))) return err("Too many attempts. Wait a few minutes, then try again.");

    // The paid order's product page context: the store must be published and open.
    const context = await loadCheckoutContext(username, productSlug);
    if (!context?.open) return err("This offer isn't available anymore.");
    const offer = await findUpsellOffer(context.store._id, orderId, new Date(), offerKind);
    if (!offer) return err("This offer isn't available anymore.");

    const free = offer.priceCents === 0;
    const provider = free ? null : providerForStore(context.store);
    if (!free && !provider) return err("Payments aren't set up for this store yet.");

    const newOrderId = await createPendingOrder({
      storeId: context.store._id,
      productId: offer.productId,
      item: { title: offer.title, unitPriceCents: offer.priceCents },
      buyerEmail: offer.buyer.email,
      buyerName: offer.buyer.name,
      buyerPhone: offer.buyer.phone,
      answers: [],
      subtotalCents: offer.priceCents,
      discountCents: 0,
      totalCents: offer.priceCents,
      currency: context.store.currency,
      provider: free ? "free" : provider!.name,
      upsellOf: orderId,
      offer: offerKind,
      // The upsell came from the same visit (D-112) and affiliate (D-113) as the order before it.
      ...(await originOfOrder(context.store._id, orderId)),
    });

    const base = `/@${context.store.slug}/${offer.slug}`;
    if (free || !provider) {
      await markFreeOrderPaid(newOrderId);
    } else {
      try {
        const appUrl = await appOrigin();
        const session = await provider.createCheckout({
          orderId: newOrderId,
          title: offer.title,
          amountCents: offer.priceCents,
          currency: context.store.currency,
          buyerEmail: offer.buyer.email,
          sellerName: context.store.name,
          successUrl: `${appUrl}${base}/thank-you?order=${newOrderId}`,
          cancelUrl: `${appUrl}/@${context.store.slug}/${context.product.slug}/thank-you?order=${orderId}`,
          connectedAccountId: sellerAccountFor(provider, context.store),
        });
        await attachProviderSession(newOrderId, session.providerSessionId);
        redirect(session.url);
      } catch (error) {
        unstable_rethrow(error);
        await markOrderFailed(newOrderId).catch(() => undefined);
        logger.error("upsells.provider_failed", { name: error instanceof Error ? error.name : undefined });
        return err(GENERIC);
      }
    }
    redirect(`${base}/thank-you?order=${newOrderId}`);
  } catch (error) {
    unstable_rethrow(error);
    logger.error("upsells.checkout_failed", { name: error instanceof Error ? error.name : undefined });
    return err(GENERIC);
  }
}
