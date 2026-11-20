"use server";

import { randomUUID } from "node:crypto";

import { redirect, unstable_rethrow } from "next/navigation";

import { appOrigin } from "@/lib/app-origin";
import { busyTimesForStore, holdSlot } from "@/lib/coaching/bookings";
import { findCheckoutBump } from "@/lib/bumps/queries";
import { withBump } from "@/lib/bumps/rules";
import { findCouponByCode, holdCoupon } from "@/lib/coupons/queries";
import { couponDiscountCents, couponProblem, totalProblem } from "@/lib/coupons/rules";
import { bookingInput } from "@/lib/coaching/schemas";
import { findSlot } from "@/lib/coaching/slots";
import { PAUSED_MESSAGES } from "@/lib/plans/access";
import { affiliateForCheckout } from "@/lib/affiliates/queries";
import { AFFILIATE_FIELD } from "@/lib/affiliates/rules";
import { ATTRIBUTION_FIELDS, attributionFrom } from "@/lib/analytics/attribution";
import { CHECKOUT_RATE_LIMIT, ROOT_DOMAIN } from "@/lib/config";
import { logger } from "@/lib/logger";
import { validateAnswers } from "@/lib/orders/answers";
import { orderAmounts } from "@/lib/orders/pricing";
import { payableCents } from "@/lib/products/pricing";
import {
  attachProviderSession,
  canBuy,
  createPendingOrder,
  findPendingMockOrder,
  loadCheckoutContext,
  markOrderFailed,
  productPathForOrder,
} from "@/lib/orders/queries";
import { scheduleCartReminder } from "@/lib/abandoned-cart/job";
import { consentForCheckout } from "@/lib/subscribers/rules";
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
const TIME_TAKEN = "That time isn't available any more. Pick another time.";

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
    // A paused store takes no new orders, free ones included (D-072).
    if (!context.open) return err(PAUSED_MESSAGES.checkout);

    // A coupon (D-088): found in this store by its code and checked on the server; only its own
    // terms from the database decide the discount.
    const code = typeof formData.get("couponCode") === "string" ? String(formData.get("couponCode")).trim() : "";
    const coupon = code ? await findCouponByCode(context.store._id, code) : null;
    if (code) {
      const problem = couponProblem(coupon, context.product.id, new Date());
      if (problem) return err(problem, "couponCode");
    }

    // The price comes from the product in the database, never from the form (CLAUDE.md 7, D-047).
    const mainAmount = orderAmounts(context.product, coupon ? couponDiscountCents(payableCents(context.product), coupon) : 0);
    // An order bump the buyer ticked (D-089): only the one saved on this product, still published in
    // this store, at the price saved with it. The coupon applies to the main product only.
    // A lead magnet stays free: it never offers a bump (D-094).
    const bump = context.product.type !== "lead_magnet" && formData.get("addBump") === "on" ? await findCheckoutBump(context.store._id, context.product.bump) : null;
    const amount = bump ? withBump(mainAmount, bump.priceCents) : mainAmount;
    if (coupon) {
      const low = totalProblem(amount.totalCents, context.store.currency);
      if (low) return err(low, "couponCode");
    }

    const answers = validateAnswers(context.product.checkout.questions, answersFromForm(formData));
    if (!answers.ok) return err(answers.error, `answer-${answers.questionId}`);

    // A coaching call (D-083): the picked start must be one the slot engine offers right now, with
    // the store's other bookings around it taken into account. The browser's time is never trusted.
    let booking: { start: Date; end: Date; buyerTimeZone: string | null } | null = null;
    if (context.product.type === "coaching") {
      const picked = bookingInput.safeParse({ slotStart: formData.get("slotStart") ?? undefined, buyerTimeZone: formData.get("buyerTimeZone") ?? undefined });
      if (!picked.success || !context.product.coaching) return err("Pick a time for your call.", "slotStart");
      const now = new Date();
      const around = 6 * 60 * 60_000;
      const busy = await busyTimesForStore(context.store._id, new Date(picked.data.slotStart.getTime() - around), new Date(picked.data.slotStart.getTime() + around), now);
      const slot = findSlot(context.product.coaching, busy, now, picked.data.slotStart);
      if (!slot) return err(TIME_TAKEN, "slotStart");
      booking = { start: slot.start, end: slot.end, buyerTimeZone: picked.data.buyerTimeZone };
    }

    const free = amount.totalCents === 0;
    // Where the buyer came from (D-112): labels only, cleaned; a visit from our own pages is direct.
    const attribution = attributionFrom(
      {
        source: formData.get(ATTRIBUTION_FIELDS.source),
        medium: formData.get(ATTRIBUTION_FIELDS.medium),
        campaign: formData.get(ATTRIBUTION_FIELDS.campaign),
        referrer: formData.get(ATTRIBUTION_FIELDS.referrer),
      },
      ROOT_DOMAIN,
    );
    // An affiliate's code from the visit (D-113): only an active affiliate of this store counts.
    const affiliate = await affiliateForCheckout(context.store._id, formData.get(AFFILIATE_FIELD));
    // Consent to the store's emails (D-094): signing up for a lead magnet, or the unticked-by-default
    // "Email me updates" box. The words come from the server, matching what the form showed.
    const marketingConsent = consentForCheckout(context.store.name, context.product, formData.get("marketingConsent") === "on");
    const provider = free ? null : providerForStore(context.store);
    if (!free && !provider) return err("Payments aren't set up for this store yet. Please check back soon.");
    if (!free && !canBuy(context)) return err("Payments aren't set up for this store yet. Please check back soon.");

    const orderId = await createPendingOrder({
      storeId: context.store._id,
      productId: context.product.id,
      item: { title: context.product.title, unitPriceCents: mainAmount.subtotalCents },
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      buyerPhone: buyer.phone ?? null,
      answers: answers.answers,
      subtotalCents: amount.subtotalCents,
      discountCents: amount.discountCents,
      totalCents: amount.totalCents,
      currency: context.store.currency,
      provider: free ? "free" : provider!.name,
      ...(booking ? { booking } : {}),
      ...(marketingConsent ? { marketingConsent } : {}),
      ...(attribution ? { attribution } : {}),
      ...(affiliate ? { affiliate } : {}),
      ...(coupon ? { coupon: { couponId: coupon._id, code: coupon.code, discountCents: amount.discountCents - orderAmounts(context.product).discountCents } } : {}),
      ...(bump ? { bump: { productId: bump.productId, title: bump.title, priceCents: bump.priceCents } } : {}),
    });

    // Holds one use of the coupon (the limit is never exceeded); if it is used up meanwhile, the order is dropped.
    if (coupon) {
      const held = await holdCoupon({ storeId: context.store._id, couponId: coupon._id, orderId, email: buyer.email });
      if (held !== "held") {
        await markOrderFailed(orderId).catch(() => undefined);
        return err(held === "already_used" ? "You have already used this code." : "This code has been used up.", "couponCode");
      }
    }

    // Holds the time while the buyer pays; if someone else got it first, the order is dropped.
    if (booking) {
      const held = await holdSlot({ storeId: context.store._id, productId: context.product.id, orderId, ...booking });
      if (held === "taken") {
        await markOrderFailed(orderId).catch(() => undefined);
        return err(TIME_TAKEN, "slotStart");
      }
    }

    const base = `/@${context.store.slug}/${context.product.slug}`;
    const appUrl = await appOrigin();

    if (free || !provider) {
      await markFreeOrderPaid(orderId);
    } else {
      try {
        const session = await provider.createCheckout({
          orderId,
          title: bump ? `${context.product.title} + ${bump.title}` : context.product.title,
          amountCents: amount.totalCents,
          currency: context.store.currency,
          buyerEmail: buyer.email,
          successUrl: `${appUrl}${base}/thank-you?order=${orderId}`,
          cancelUrl: `${appUrl}${base}`,
          connectedAccountId: context.store.stripeAccountId,
        });
        await attachProviderSession(orderId, session.providerSessionId);
        // One reminder two hours later if this paid checkout is not finished (D-096); never throws.
        await scheduleCartReminder(orderId, new Date());
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
