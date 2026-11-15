import "server-only";

import { randomUUID } from "node:crypto";

import { connection } from "next/server";

import { collections, type CheckoutQuestionDoc, type OrderDoc, type StoreDoc } from "@/lib/db/collections";
import { providerForStore } from "@/lib/payments";
import { can, storeAccess } from "@/lib/plans/access";
import { payableCents } from "@/lib/products/pricing";

// Reads and writes for checkout. The buyer is anonymous, so every lookup goes through the public
// username and product slug and only finds PUBLISHED stores and products. The checkout page needs
// the product's questions, but never the delivery link or the email texts.

const SLUG = /^[a-z0-9-]{3,30}$/;
const PRODUCT_SLUG = /^[a-z0-9-]{1,60}$/;

export type CheckoutContext = {
  store: Pick<StoreDoc, "_id" | "slug" | "name" | "theme" | "currency" | "stripeAccountId" | "stripeChargesEnabled" | "bio" | "avatarUrl" | "socialLinks" | "link">;
  /** False while the store is paused after its free trial (D-072): no new orders, free ones included. */
  open: boolean;
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    priceCents: number;
    salePriceCents: number | null;
    buttonText: string | null;
    checkout: { headline: string | null; askPhone: boolean; questions: CheckoutQuestionDoc[] };
    thankYou: string | null;
    redirectUrl: string | null;
  };
};

const STORE_FIELDS = {
  slug: 1,
  name: 1,
  bio: 1,
  avatarUrl: 1,
  socialLinks: 1,
  link: 1,
  theme: 1,
  currency: 1,
  stripeAccountId: 1,
  stripeChargesEnabled: 1,
  planTier: 1,
  trialEndsAt: 1,
  foundingEndsAt: 1,
  "billing.plan": 1,
  "billing.status": 1,
  "billing.currentPeriodEnd": 1,
  "billing.cancelAtPeriodEnd": 1,
} as const;
const PRODUCT_FIELDS = {
  slug: 1,
  title: 1,
  description: 1,
  coverUrl: 1,
  priceCents: 1,
  salePriceCents: 1,
  buttonText: 1,
  "checkout.headline": 1,
  "checkout.askPhone": 1,
  "checkout.questions": 1,
  "afterPurchase.thankYou": 1,
  "afterPurchase.redirectUrl": 1,
} as const;

/** The published store and product for a checkout, or null. Never includes the delivery link. */
export async function loadCheckoutContext(username: string, productSlug: string): Promise<CheckoutContext | null> {
  // typeof first: RegExp.test turns an array like ["maya"] into "maya" (R9, no operator or array input).
  if (typeof username !== "string" || typeof productSlug !== "string" || !SLUG.test(username) || !PRODUCT_SLUG.test(productSlug)) return null;
  const { stores, products } = await collections();

  const store = await stores.findOne({ slug: username, isPublished: true }, { projection: STORE_FIELDS });
  if (!store) return null;
  const product = await products.findOne({ storeId: store._id, slug: productSlug, status: "published" }, { projection: PRODUCT_FIELDS });
  if (!product) return null;

  // The plan fields only decide `open`; they are not passed on to the page.
  const { planTier, trialEndsAt, foundingEndsAt, billing, ...storeFields } = store;
  await connection(); // open or paused depends on the current time
  return {
    store: storeFields,
    open: can(storeAccess({ planTier, trialEndsAt, foundingEndsAt, billing }), "sell"),
    product: {
      id: product._id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      coverUrl: product.coverUrl,
      priceCents: product.priceCents,
      // Products saved before D-047 have no discount field yet.
      salePriceCents: product.salePriceCents ?? null,
      buttonText: product.buttonText,
      checkout: product.checkout,
      thankYou: product.afterPurchase?.thankYou ?? null,
      redirectUrl: product.afterPurchase?.redirectUrl ?? null,
    },
  };
}

/** Can a buyer pay for this product right now? Free products always; paid ones need a payment provider. */
export function canBuy(context: CheckoutContext): boolean {
  if (!context.open) return false;
  const free = payableCents(context.product) === 0;
  return free || providerForStore(context.store) !== null;
}

export type NewOrder = Pick<
  OrderDoc,
  "storeId" | "productId" | "item" | "buyerEmail" | "buyerName" | "buyerPhone" | "answers" | "subtotalCents" | "discountCents" | "totalCents" | "currency" | "provider"
>;

/** Creates a pending order. Amounts are what the server computed from the product (lib/orders/pricing.ts). */
export async function createPendingOrder(input: NewOrder): Promise<string> {
  const { orders } = await collections();
  const id = randomUUID();
  await orders.insertOne({
    _id: id,
    ...input,
    status: "pending",
    providerSessionId: null,
    createdAt: new Date(),
    paidAt: null,
  });
  return id;
}

export async function attachProviderSession(orderId: string, providerSessionId: string): Promise<void> {
  const { orders } = await collections();
  await orders.updateOne({ _id: orderId, status: "pending" }, { $set: { providerSessionId } });
}

export async function markOrderFailed(orderId: string): Promise<void> {
  const { orders } = await collections();
  await orders.updateOne({ _id: orderId, status: "pending" }, { $set: { status: "failed" } });
}

/** What the thank-you page may show: the order's status for this store only. The order id is an unguessable uuid. */
export async function findOrderForThankYou(storeId: string, orderId: string): Promise<{ status: OrderDoc["status"]; productId: string } | null> {
  const { orders } = await collections();
  const doc = await orders.findOne({ _id: orderId, storeId }, { projection: { status: 1, productId: 1 } });
  return doc ? { status: doc.status, productId: doc.productId } : null;
}

/** Development-only mock payment page: a pending mock order with its product title and total. */
export async function findPendingMockOrder(orderId: string): Promise<{ id: string; storeId: string; title: string; totalCents: number; currency: string; productId: string } | null> {
  const { orders } = await collections();
  const doc = await orders.findOne({ _id: orderId, provider: "mock", status: "pending" });
  return doc ? { id: doc._id, storeId: doc.storeId, title: doc.item.title, totalCents: doc.totalCents, currency: doc.currency, productId: doc.productId } : null;
}

/** Public path of a product's page from an order's store and product ids, for redirects. */
export async function productPathForOrder(storeId: string, productId: string): Promise<{ username: string; productSlug: string } | null> {
  const { stores, products } = await collections();
  const [store, product] = await Promise.all([
    stores.findOne({ _id: storeId }, { projection: { slug: 1 } }),
    products.findOne({ _id: productId, storeId }, { projection: { slug: 1 } }),
  ]);
  return store && product ? { username: store.slug, productSlug: product.slug } : null;
}
