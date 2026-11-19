import "server-only";

import { collections, type ProductDoc } from "@/lib/db/collections";
import { can, storeAccess } from "@/lib/plans/access";
import { UPSELL_TYPES, upsellWindowOpen, type UpsellInput } from "@/lib/upsells/rules";

// Upsells (D-099). Creator writes filter by the `storeId` of requireCreator(); an upsell can only
// name another product of the same store. The offer is read for a paid order of the store; the
// price always comes from the product saved in the database.

const NOT_DELETED = { deletedAt: { $in: [null] } };

/** Saves (or removes, with null) the upsell of one product of this store. */
export async function saveProductUpsell(storeId: string, productId: string, upsell: UpsellInput): Promise<"saved" | "not_found" | "bad_product"> {
  const { products } = await collections();
  if (upsell) {
    if (upsell.productId === productId) return "bad_product";
    const target = await products.countDocuments({ _id: upsell.productId, storeId, type: { $in: UPSELL_TYPES }, ...NOT_DELETED });
    if (target !== 1) return "bad_product";
  }
  const result = await products.updateOne({ _id: productId, storeId, ...NOT_DELETED }, { $set: { upsell, updatedAt: new Date() } });
  return result.matchedCount === 1 ? "saved" : "not_found";
}

export type UpsellOffer = {
  productId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  type: ProductDoc["type"];
  priceCents: number;
  regularCents: number;
  headline: string | null;
  /** From the paid order: who buys, without asking again. */
  buyer: { email: string; name: string; phone: string | null };
};

/**
 * The offer for a paid order of this store, or null. Shown only when: the order is paid, is not
 * itself a bump or upsell order, and was paid less than two hours ago; its product has an upsell;
 * the offered product is this store's, published and of an upsell type; the buyer has not bought
 * it already; and the store's plan includes upsells and it can sell.
 */
export async function findUpsellOffer(storeId: string, orderId: string, now: Date = new Date()): Promise<UpsellOffer | null> {
  const { orders, products, stores } = await collections();
  const order = await orders.findOne({ _id: orderId, storeId, status: "paid" }, { projection: { productId: 1, buyerEmail: 1, buyerName: 1, buyerPhone: 1, paidAt: 1, bumpOf: 1, upsellOf: 1 } });
  if (!order || order.bumpOf || order.upsellOf || !upsellWindowOpen(order.paidAt ?? null, now)) return null;

  const store = await stores.findOne({ _id: storeId }, { projection: { planTier: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1 } });
  if (!store) return null;
  const access = storeAccess(store, now);
  if (!can(access, "upsells") || !can(access, "sell")) return null;

  const source = await products.findOne({ _id: order.productId, storeId }, { projection: { upsell: 1 } });
  const upsell = source?.upsell;
  if (!upsell) return null;
  const target = await products.findOne(
    { _id: upsell.productId, storeId, status: "published", type: { $in: UPSELL_TYPES }, ...NOT_DELETED },
    { projection: { slug: 1, title: 1, coverUrl: 1, type: 1, priceCents: 1, salePriceCents: 1 } },
  );
  if (!target) return null;
  const owned = await orders.countDocuments({ storeId, productId: target._id, buyerEmail: order.buyerEmail, status: "paid" }, { limit: 1 });
  if (owned) return null;

  return {
    productId: target._id,
    slug: target.slug,
    title: target.title,
    coverUrl: target.coverUrl,
    type: target.type,
    priceCents: upsell.priceCents,
    regularCents: target.salePriceCents ?? target.priceCents,
    headline: upsell.headline,
    buyer: { email: order.buyerEmail, name: order.buyerName, phone: order.buyerPhone },
  };
}
