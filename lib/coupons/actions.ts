"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { createCoupon, findCouponByCode, setCouponActive } from "@/lib/coupons/queries";
import { couponDiscountCents, couponInputFor, couponLabel, couponProblem, totalProblem } from "@/lib/coupons/rules";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { loadCheckoutContext } from "@/lib/orders/queries";
import { orderAmounts } from "@/lib/orders/pricing";
import { formatMoney } from "@/lib/products/money";
import { payableCents } from "@/lib/products/pricing";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";

const MARKETING_PATH = "/dashboard/marketing";

/** Coupon checks per visitor: enough to fix a typo, too few to guess codes (CLAUDE.md 8). */
const PREVIEW_LIMIT = { max: 20, windowMinutes: 15 } as const;

export type CouponPreview = { code: string; label: string; discount: string; total: string; free: boolean; discountCents: number; totalCents: number };

/**
 * Checks a code at checkout and shows the new total (D-088). Information only: `startCheckout`
 * checks the code again and computes the amount from the database. Rate limited per visitor.
 */
export async function previewCoupon(username: string, productSlug: string, rawCode: unknown): Promise<Result<CouponPreview>> {
  if (typeof rawCode !== "string" || rawCode.trim() === "" || rawCode.length > 40) return err("Enter a code.");
  try {
    const ipHash = await getClientIpHash();
    if (ipHash && !(await takeRateLimit(rateLimitKey("coupon:ip", ipHash), PREVIEW_LIMIT.max, PREVIEW_LIMIT.windowMinutes))) return err("Too many tries. Wait a few minutes, then try again.");

    const context = await loadCheckoutContext(username, productSlug);
    if (!context) return err("This product isn't available anymore.");
    const coupon = await findCouponByCode(context.store._id, rawCode);
    const problem = couponProblem(coupon, context.product.id, new Date());
    if (problem || !coupon) return err(problem ?? "This code isn't valid.");

    const discount = couponDiscountCents(payableCents(context.product), coupon);
    const amount = orderAmounts(context.product, discount);
    const low = totalProblem(amount.totalCents, context.store.currency);
    if (low) return err(low);
    const currency = context.store.currency;
    return ok({
      code: coupon.code,
      label: couponLabel(coupon, currency),
      discount: formatMoney(discount, currency),
      total: amount.totalCents === 0 ? "Free" : formatMoney(amount.totalCents, currency),
      free: amount.totalCents === 0,
      discountCents: discount,
      totalCents: amount.totalCents,
    });
  } catch (error) {
    logger.error("coupons.preview_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't check this code. Try again.");
  }
}

export type CreateCouponState = Result<{ id: string }> | null;

/** Creates a coupon for the session owner's store. The form arrives as one JSON payload. */
export async function createCouponAction(_prev: CreateCouponState, formData: FormData): Promise<CreateCouponState> {
  const { user, store } = await requireCreator(MARKETING_PATH);
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 10_000) return err("Check the form and try again.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err("Check the form and try again.");
  }
  const parsed = couponInputFor(store.currency).safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the form and try again.", typeof field === "string" ? field : undefined);
  }
  if (!(await takeRateLimit(rateLimitKey("coupon-write:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");

  try {
    const result = await createCoupon(store.id, parsed.data);
    if (result === "taken") return err("You already have a code with this name.", "code");
    if (result === "limit") return err("You have reached the coupon limit for your store.");
    if (result === "bad_products") return err("Pick products from your own store.", "productIds");
    revalidatePath(MARKETING_PATH);
    return ok({ id: result.id });
  } catch (error) {
    logger.error("coupons.create_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the coupon. Try again.");
  }
}

/** Turns a coupon of the session owner's store on or off. */
export async function setCouponActiveAction(couponId: string, active: boolean): Promise<Result<{ active: boolean }>> {
  const { store } = await requireCreator(MARKETING_PATH);
  if (typeof couponId !== "string" || !isUuid(couponId) || typeof active !== "boolean") return err("We couldn't find that coupon.");
  try {
    if (!(await setCouponActive(store.id, couponId, active))) return err("We couldn't find that coupon.");
  } catch (error) {
    logger.error("coupons.toggle_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(MARKETING_PATH);
  return ok({ active });
}
