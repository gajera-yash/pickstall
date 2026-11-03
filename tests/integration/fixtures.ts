import { randomUUID } from "node:crypto";

import { collections, type OrderDoc, type ProductDoc, type StoreDoc } from "@/lib/db/collections";

// Seeds documents straight into the in-memory test database, in the shapes of lib/db/collections.ts.

export async function seedStore(overrides: Partial<StoreDoc> = {}): Promise<StoreDoc> {
  const { stores } = await collections();
  const id = randomUUID();
  const doc: StoreDoc = {
    _id: id,
    ownerId: randomUUID(),
    slug: `store-${id.slice(0, 8)}`,
    name: "Test store",
    bio: null,
    avatarUrl: null,
    socialLinks: [],
    theme: { preset: "clean", accent: "#0056FF" },
    currency: "usd",
    stripeAccountId: null,
    stripeChargesEnabled: false,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await stores.insertOne(doc);
  return doc;
}

export async function seedProduct(storeId: string, overrides: Partial<ProductDoc> = {}): Promise<ProductDoc> {
  const { products } = await collections();
  const id = randomUUID();
  const doc: ProductDoc = {
    _id: id,
    storeId,
    type: "digital",
    title: "Recipe pack",
    slug: `product-${id.slice(0, 8)}`,
    description: null,
    coverUrl: null,
    priceCents: 1900,
    salePriceCents: null,
    externalUrl: "https://files.example.com/secret-download",
    buttonText: null,
    downloadLimit: null,
    status: "published",
    checkout: { headline: null, askPhone: false, questions: [] },
    afterPurchase: { thankYou: null, redirectUrl: null, emailSubject: null, emailBody: null },
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await products.insertOne(doc);
  return doc;
}

export async function seedOrder(product: ProductDoc, overrides: Partial<OrderDoc> = {}): Promise<OrderDoc> {
  const { orders } = await collections();
  const id = randomUUID();
  const doc: OrderDoc = {
    _id: id,
    storeId: product.storeId,
    productId: product._id,
    item: { title: product.title, unitPriceCents: product.priceCents },
    buyerEmail: "buyer@example.com",
    buyerName: "Buyer",
    buyerPhone: null,
    answers: [],
    subtotalCents: product.priceCents,
    discountCents: 0,
    totalCents: product.priceCents,
    currency: "usd",
    status: "paid",
    provider: "mock",
    providerSessionId: `mock_${id}`,
    createdAt: new Date(),
    paidAt: new Date(),
    ...overrides,
  };
  await orders.insertOne(doc);
  return doc;
}
