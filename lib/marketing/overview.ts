import "server-only";

import { cartStats, findCartSettings } from "@/lib/abandoned-cart/queries";
import { listAffiliates } from "@/lib/affiliates/queries";
import { findWelcomeEmail, listBroadcasts } from "@/lib/broadcasts/queries";
import { listCoupons } from "@/lib/coupons/queries";
import { findPixelSettings } from "@/lib/pixels/queries";
import type { CreatorProduct } from "@/lib/products/queries";
import { findReviewRequestSettings } from "@/lib/review-request/queries";
import { findEmailLook } from "@/lib/stores/queries";
import { countSubscribed } from "@/lib/subscribers/queries";
import type { EmailLook } from "@/lib/email/looks";

// The Marketing overview (D-129): a short status per tool. Everything is read for the session's own
// store (store id and owner id from requireCreator). A part that cannot be read shows as unknown
// (null) instead of breaking the page.

export type MarketingOverview = {
  coupons: { active: number } | null;
  offers: { bumps: number; upsells: number; downsells: number };
  subscribers: number | null;
  lastBroadcastAt: Date | null;
  emailLook: EmailLook | null;
  welcomeOn: boolean;
  cart: { on: boolean; sent: number; recovered: number } | null;
  reviewOn: boolean | null;
  affiliates: { active: number } | null;
  pixels: { meta: boolean; google: boolean } | null;
};

const safe = <T>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

/** A coupon buyers can use now: switched on, not expired and not used up. */
export function couponIsLive(coupon: { active: boolean; expiresAt: Date | null; maxRedemptions: number | null; redemptionCount: number }, now: Date): boolean {
  return coupon.active && (!coupon.expiresAt || coupon.expiresAt > now) && (coupon.maxRedemptions === null || coupon.redemptionCount < coupon.maxRedemptions);
}

/** Bumps, upsells and downsells set on products that are not archived. */
export function offerCounts(products: Pick<CreatorProduct, "status" | "bump" | "upsell" | "downsell">[]): MarketingOverview["offers"] {
  const live = products.filter((product) => product.status !== "archived");
  return {
    bumps: live.filter((product) => product.bump).length,
    upsells: live.filter((product) => product.upsell).length,
    downsells: live.filter((product) => product.downsell).length,
  };
}

export async function marketingOverview(storeId: string, ownerId: string, products: CreatorProduct[], now: Date = new Date()): Promise<MarketingOverview> {
  const [coupons, subscribers, broadcasts, emailLook, welcome, cart, stats, review, affiliates, pixels] = await Promise.all([
    safe(listCoupons(storeId)),
    safe(countSubscribed(storeId)),
    safe(listBroadcasts(storeId, 1)),
    safe(findEmailLook(ownerId)),
    safe(findWelcomeEmail(storeId)),
    safe(findCartSettings(storeId)),
    safe(cartStats(storeId)),
    safe(findReviewRequestSettings(storeId)),
    safe(listAffiliates(storeId)),
    safe(findPixelSettings(storeId)),
  ]);
  return {
    coupons: coupons ? { active: coupons.filter((coupon) => couponIsLive(coupon, now)).length } : null,
    offers: offerCounts(products),
    subscribers,
    lastBroadcastAt: broadcasts?.[0]?.createdAt ?? null,
    emailLook,
    // Never saved reads as off.
    welcomeOn: welcome?.enabled ?? false,
    cart: cart ? { on: cart.enabled, sent: stats?.sent ?? 0, recovered: stats?.recovered ?? 0 } : null,
    reviewOn: review ? review.enabled : null,
    affiliates: affiliates ? { active: affiliates.filter((affiliate) => affiliate.active).length } : null,
    pixels: pixels ? { meta: Boolean(pixels.metaPixelId), google: Boolean(pixels.googleTagId) } : null,
  };
}
