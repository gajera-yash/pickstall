import "server-only";

import { collections, type OrderDoc } from "@/lib/db/collections";

// The buyer's library (R7). A buyer is identified by the verified email of their session (they
// proved it with the 6-digit code), and sees only paid or refunded orders placed with that email.
// The delivery link never leaves the server except through `grantAccess`, after every check.

export type Purchase = {
  orderId: string;
  title: string;
  storeName: string;
  storeSlug: string | null;
  productSlug: string | null;
  coverUrl: string | null;
  paidAt: Date | null;
  status: OrderDoc["status"];
  /** The product still exists and has something to open. */
  available: boolean;
  downloadLimit: number | null;
  accessCount: number;
};

const normalize = (email: string) => email.trim().toLowerCase();

async function loadDetails(orders: OrderDoc[]): Promise<Purchase[]> {
  const { stores, products } = await collections();
  const storeIds = [...new Set(orders.map((order) => order.storeId))];
  const productIds = [...new Set(orders.map((order) => order.productId))];
  const [storeDocs, productDocs] = await Promise.all([
    stores.find({ _id: { $in: storeIds } }, { projection: { name: 1, slug: 1 } }).toArray(),
    products.find({ _id: { $in: productIds } }, { projection: { slug: 1, coverUrl: 1, externalUrl: 1, downloadLimit: 1, status: 1 } }).toArray(),
  ]);
  const storeById = new Map(storeDocs.map((doc) => [doc._id, doc]));
  const productById = new Map(productDocs.map((doc) => [doc._id, doc]));

  return orders.map((order) => {
    const store = storeById.get(order.storeId);
    const product = productById.get(order.productId);
    return {
      orderId: order._id,
      title: order.item.title,
      storeName: store?.name ?? "Pickstall store",
      storeSlug: store?.slug ?? null,
      productSlug: product?.slug ?? null,
      coverUrl: product?.coverUrl ?? null,
      paidAt: order.paidAt,
      status: order.status,
      available: Boolean(product?.externalUrl),
      downloadLimit: product?.downloadLimit ?? null,
      accessCount: order.accessCount ?? 0,
    };
  });
}

/** This buyer's purchases, newest first. */
export async function listPurchases(email: string): Promise<Purchase[]> {
  const { orders } = await collections();
  const docs = await orders
    .find({ buyerEmail: normalize(email), status: { $in: ["paid", "refunded"] } })
    .sort({ paidAt: -1, createdAt: -1 })
    .limit(100)
    .toArray();
  return docs.length === 0 ? [] : loadDetails(docs);
}

/** One purchase of this buyer, or null (also for someone else's order id). */
export async function findPurchase(email: string, orderId: string): Promise<Purchase | null> {
  const { orders } = await collections();
  const doc = await orders.findOne({ _id: orderId, buyerEmail: normalize(email), status: { $in: ["paid", "refunded"] } });
  if (!doc) return null;
  return (await loadDetails([doc]))[0] ?? null;
}

export type AccessResult = { ok: true; url: string } | { ok: false; reason: "not_found" | "refunded" | "unavailable" | "limit" };

/**
 * Hands out the delivery link, once every check passes: the order is this buyer's, it is paid (a
 * refund removes access), the product still has a link, and the download limit is not used up. The
 * limit is enforced by one atomic update, so two parallel requests cannot both take the last use.
 */
export async function grantAccess(email: string, orderId: string): Promise<AccessResult> {
  const { orders, products } = await collections();
  const buyerEmail = normalize(email);

  const order = await orders.findOne({ _id: orderId, buyerEmail }, { projection: { productId: 1, storeId: 1, status: 1 } });
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status === "refunded") return { ok: false, reason: "refunded" };
  if (order.status !== "paid") return { ok: false, reason: "not_found" };

  const product = await products.findOne({ _id: order.productId, storeId: order.storeId }, { projection: { externalUrl: 1, downloadLimit: 1 } });
  if (!product?.externalUrl) return { ok: false, reason: "unavailable" };

  const limit = product.downloadLimit;
  const counted = await orders.updateOne(
    {
      _id: orderId,
      buyerEmail,
      status: "paid",
      ...(limit ? { $or: [{ accessCount: { $lt: limit } }, { accessCount: { $exists: false } }] } : {}),
    },
    { $inc: { accessCount: 1 } },
  );
  if (counted.matchedCount === 0) return { ok: false, reason: limit ? "limit" : "not_found" };

  return { ok: true, url: product.externalUrl };
}
