import "server-only";

import { collections, type ProductDoc } from "@/lib/db/collections";
import { can, storeAccess } from "@/lib/plans/access";
import { UPSELL_TYPES, upsellWindowOpen, type OfferKind, type UpsellInput } from "@/lib/upsells/rules";

// Upsells (D-099). Creator writes filter by the `storeId` of requireCreator(); an upsell can only
// name another product of the same store. The offer is read for a paid order of the store; the
// price always comes from the product saved in the database.

const NOT_DELETED = { deletedAt: { $in: [null] } };

/** Saves (or removes, with null) the upsell or the downsell (D-115) of one product of this store. */
export async function saveProductUpsell(storeId: string, productId: string, upsell: UpsellInput, kind: OfferKind = "upsell"): Promise<"saved" | "not_found" | "bad_product"> {
  const { products } = await collections();
  if (upsell) {
    if (upsell.productId === productId) return "bad_product";
    const target = await products.countDocuments({ _id: upsell.productId, storeId, type: { $in: UPSELL_TYPES }, ...NOT_DELETED });
    if (target !== 1) return "bad_product";
  }
  const result = await products.updateOne({ _id: productId, storeId, ...NOT_DELETED }, { $set: { [kind]: upsell, updatedAt: new Date() } });
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
export async function findUpsellOffer(storeId: string, orderId: string, now: Date = new Date(), kind: OfferKind = "upsell"): Promise<UpsellOffer | null> {
  const { orders, products, stores } = await collections();
  const order = await orders.findOne({ _id: orderId, storeId, status: "paid" }, { projection: { productId: 1, buyerEmail: 1, buyerName: 1, buyerPhone: 1, paidAt: 1, bumpOf: 1, upsellOf: 1 } });
  if (!order || order.bumpOf || order.upsellOf || !upsellWindowOpen(order.paidAt ?? null, now)) return null;

  const store = await stores.findOne({ _id: storeId }, { projection: { planTier: 1, suspendedAt: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1 } });
  if (!store) return null;
  const access = storeAccess(store, now);
  if (!can(access, "upsells") || !can(access, "sell")) return null;

  const source = await products.findOne({ _id: order.productId, storeId }, { projection: { [kind]: 1 } });
  const upsell = source?.[kind];
  if (!upsell) return null;
  // One after-purchase offer per order (D-115): once the upsell or downsell is paid, nothing more.
  if (await orders.countDocuments({ storeId, upsellOf: orderId, status: "paid" }, { limit: 1 })) return null;
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

export type FunnelRow = {
  productId: string;
  title: string;
  sales: number;
  salesCents: number;
  upsells: number;
  upsellCents: number;
  downsells: number;
  downsellCents: number;
};

/**
 * The after-purchase funnel per product of this store (D-115), over the last `days` days, in its
 * currency: paid main orders, then paid upsell and downsell orders bought from them. Revenue is net
 * of partial refunds. Products are listed when they have an offer set up or offer sales in the period.
 */
export async function funnelStats(storeId: string, currency: string, days: number, now: Date = new Date()): Promise<FunnelRow[]> {
  const { orders, products } = await collections();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const net = { $max: [0, { $subtract: ["$totalCents", { $ifNull: ["$amountRefundedCents", 0] }] }] };
  const paid = { storeId, status: "paid" as const, currency, paidAt: { $gte: since } };

  const [withOffers, mains, offers] = await Promise.all([
    products.find({ storeId, ...NOT_DELETED, $or: [{ upsell: { $type: "object" } }, { downsell: { $type: "object" } }] }, { projection: { title: 1 } }).toArray(),
    orders
      .aggregate<{ _id: string; sales: number; salesCents: number }>([
        { $match: { ...paid, bumpOf: null, upsellOf: null } },
        { $group: { _id: "$productId", sales: { $sum: 1 }, salesCents: { $sum: net } } },
      ])
      .toArray(),
    orders
      .aggregate<{ _id: { productId: string; offer: "upsell" | "downsell" }; count: number; cents: number }>([
        { $match: { ...paid, upsellOf: { $type: "string" } } },
        // The product of the order the offer was bought after, in the same store.
        { $lookup: { from: "orders", let: { parent: "$upsellOf" }, pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$parent"] }, storeId } }, { $project: { productId: 1 } }], as: "parent" } },
        { $unwind: "$parent" },
        { $group: { _id: { productId: "$parent.productId", offer: { $ifNull: ["$offer", "upsell"] } }, count: { $sum: 1 }, cents: { $sum: net } } },
      ])
      .toArray(),
  ]);

  const rows = new Map<string, FunnelRow>();
  const row = (productId: string) => {
    const existing = rows.get(productId);
    if (existing) return existing;
    const created: FunnelRow = { productId, title: "", sales: 0, salesCents: 0, upsells: 0, upsellCents: 0, downsells: 0, downsellCents: 0 };
    rows.set(productId, created);
    return created;
  };
  for (const product of withOffers) row(product._id).title = product.title;
  for (const offer of offers) {
    const target = row(offer._id.productId);
    if (offer._id.offer === "downsell") {
      target.downsells += offer.count;
      target.downsellCents += offer.cents;
    } else {
      target.upsells += offer.count;
      target.upsellCents += offer.cents;
    }
  }
  for (const main of mains) {
    const target = rows.get(main._id);
    if (target) Object.assign(target, { sales: main.sales, salesCents: main.salesCents });
  }

  // Titles for products that had offer sales but no offer set up any more.
  const missing = [...rows.values()].filter((item) => !item.title).map((item) => item.productId);
  if (missing.length > 0) {
    const named = await products.find({ storeId, _id: { $in: missing } }, { projection: { title: 1 } }).toArray();
    for (const product of named) row(product._id).title = product.title;
  }
  return [...rows.values()]
    .map((item) => ({ ...item, title: item.title || "Deleted product" }))
    .sort((a, b) => b.upsellCents + b.downsellCents - (a.upsellCents + a.downsellCents) || b.sales - a.sales || a.title.localeCompare(b.title));
}
