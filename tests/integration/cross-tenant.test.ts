import { beforeAll, describe, expect, it } from "vitest";

import { collections, type OrderDoc, type ProductDoc, type StoreDoc } from "@/lib/db/collections";
import { findPurchase, grantAccess, hasPurchases, listPurchases } from "@/lib/library/queries";
import { countOrdersByStatus, incomeStats, listCustomers, listOrders, listPaidOrdersForExport } from "@/lib/orders/creator-queries";
import { loadCheckoutContext } from "@/lib/orders/queries";
import { deleteProduct, findProduct, listProducts, setProductStatus, updateProduct } from "@/lib/products/queries";
import type { ProductInput } from "@/lib/products/schemas";
import { findPublicProduct, findPublicStore, listPublicProducts } from "@/lib/stores/public";
import { findStoreByOwner, setStorePublished, updateStorePageDesign, updateStoreProfile } from "@/lib/stores/queries";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

// Cross-tenant suite (PRD 5.5 item 6) on a real MongoDB: creator B can never read or change creator
// A's store, products or orders; buyers see only their own purchases; anonymous visitors see only
// published public data without private fields.

let storeA: StoreDoc;
let storeB: StoreDoc;
let productA: ProductDoc;
let draftA: ProductDoc;
let productB: ProductDoc;
let orderA: OrderDoc;
let orderB: OrderDoc;

const input: ProductInput = {
  title: "Hijacked",
  description: undefined,
  descriptionDoc: null,
  coverUrl: undefined,
  externalUrl: "https://evil.example.com",
  deliveryType: "link",
  priceCents: 1,
  salePriceCents: null,
  buttonText: undefined,
  downloadLimit: undefined,
  headline: undefined,
  askPhone: false,
  questions: [],
  thankYou: undefined,
  redirectUrl: undefined,
  emailSubject: undefined,
  emailBody: undefined,
};

beforeAll(async () => {
  storeA = await seedStore({ name: "Store A", stripeAccountId: "acct_secretA" });
  storeB = await seedStore({ name: "Store B" });
  productA = await seedProduct(storeA._id, { title: "A's guide" });
  draftA = await seedProduct(storeA._id, { title: "A's draft", status: "draft" });
  productB = await seedProduct(storeB._id, { title: "B's guide" });
  orderA = await seedOrder(productA, { buyerEmail: "alice@example.com", buyerName: "Alice", totalCents: 1900 });
  orderB = await seedOrder(productB, { buyerEmail: "bob@example.com", buyerName: "Bob", totalCents: 4200 });
});

async function reload<T extends "products" | "stores" | "orders">(name: T, id: string) {
  const all = await collections();
  return all[name].findOne({ _id: id } as never);
}

describe("products: creator B cannot touch creator A's products", () => {
  it("lists and finds only its own products", async () => {
    expect((await listProducts(storeB._id)).map((p) => p._id)).toEqual([productB._id]);
    expect(await findProduct(storeB._id, productA._id)).toBeNull();
    expect(await findProduct(storeA._id, productA._id)).not.toBeNull();
  });

  it("cannot update, publish, archive or delete A's product", async () => {
    expect(await updateProduct(storeB._id, productA._id, input)).toBe("not_found");
    expect(await setProductStatus(storeB._id, productA._id, "archived")).toBe(false);
    expect(await setProductStatus(storeB._id, draftA._id, "published")).toBe(false);
    expect(await deleteProduct(storeB._id, draftA._id)).toBe(false);

    const after = (await reload("products", productA._id)) as ProductDoc;
    expect(after.title).toBe("A's guide");
    expect(after.externalUrl).toBe(productA.externalUrl);
    expect(after.status).toBe("published");
    expect(await reload("products", draftA._id)).not.toBeNull();
  });
});

describe("stores: writes go only to the owner's own store", () => {
  it("finds a store only by its owner", async () => {
    expect((await findStoreByOwner(storeA.ownerId))?.id).toBe(storeA._id);
    expect(await findStoreByOwner("someone-else")).toBeNull();
  });

  it("B's profile, design and publish changes leave A untouched", async () => {
    await updateStoreProfile(storeB.ownerId, { name: "B renamed", bio: undefined, avatarUrl: undefined, currency: "gbp", socialLinks: [] });
    await updateStorePageDesign(storeB.ownerId, { themePreset: "clean", accent: "#000000" });
    await setStorePublished(storeB.ownerId, true);

    const a = (await reload("stores", storeA._id)) as StoreDoc;
    expect(a.name).toBe("Store A");
    expect(a.currency).toBe("usd");
    expect(a.theme.accent).toBe("#0056FF");
    expect(((await reload("stores", storeB._id)) as StoreDoc).name).toBe("B renamed");
  });
});

describe("orders, customers and income are per store", () => {
  it("lists only the store's own orders and counts", async () => {
    expect((await listOrders(storeB._id)).orders.map((o) => o.id)).toEqual([orderB._id]);
    expect((await listOrders(storeA._id, { q: "bob" })).orders).toEqual([]);
    expect((await countOrdersByStatus(storeB._id)).paid).toBe(1);
    expect((await listPaidOrdersForExport(storeB._id)).map((o) => o.id)).toEqual([orderB._id]);
  });

  it("shows only the store's own customers", async () => {
    expect((await listCustomers(storeB._id)).map((c) => c.email)).toEqual(["bob@example.com"]);
    expect(await listCustomers(storeB._id, { q: "alice" })).toEqual([]);
  });

  it("adds up only the store's own revenue", async () => {
    const stats = await incomeStats(storeA._id, "usd", 7);
    expect(stats.totalPaidOrders).toBe(1);
    expect(stats.series.revenueCents.reduce((sum, cents) => sum + cents, 0)).toBe(1900);
  });

  it("treats a search for regex characters as plain text", async () => {
    expect((await listOrders(storeA._id, { q: ".*" })).orders).toEqual([]);
  });
});

describe("buyers see only their own purchases", () => {
  it("lists and opens only orders placed with their email", async () => {
    expect((await listPurchases("alice@example.com")).map((p) => p.orderId)).toEqual([orderA._id]);
    expect(await findPurchase("alice@example.com", orderB._id)).toBeNull();
    expect(await hasPurchases("nobody@example.com")).toBe(false);
  });

  it("matches the email case-insensitively but never another buyer's order", async () => {
    expect((await listPurchases("  ALICE@example.com ")).map((p) => p.orderId)).toEqual([orderA._id]);
    expect(await grantAccess("alice@example.com", orderB._id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("opens the buyer's own paid order and never exposes the link in the purchase list", async () => {
    expect(await grantAccess("alice@example.com", orderA._id)).toEqual({ ok: true, url: productA.externalUrl });
    const purchase = await findPurchase("alice@example.com", orderA._id);
    expect(JSON.stringify(purchase)).not.toContain("secret-download");
  });

  it("removes access after a refund and never opens a pending order", async () => {
    const refunded = await seedOrder(productA, { buyerEmail: "carol@example.com", status: "refunded" });
    const pending = await seedOrder(productA, { buyerEmail: "carol@example.com", status: "pending", paidAt: null });
    expect(await grantAccess("carol@example.com", refunded._id)).toEqual({ ok: false, reason: "refunded" });
    expect(await grantAccess("carol@example.com", pending._id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("enforces the download limit atomically under parallel opens", async () => {
    const limited = await seedProduct(storeA._id, { downloadLimit: 2 });
    const order = await seedOrder(limited, { buyerEmail: "dan@example.com" });
    const results = await Promise.all(Array.from({ length: 6 }, () => grantAccess("dan@example.com", order._id)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(((await reload("orders", order._id)) as OrderDoc).accessCount).toBe(2);
  });
});

describe("anonymous visitors see only published public data", () => {
  it("hides draft stores and draft products", async () => {
    const draftStore = await seedStore({ isPublished: false });
    expect(await findPublicStore(draftStore.slug)).toBeNull();
    const listed = (await listPublicProducts(storeA._id)).map((p) => p.id);
    expect(listed).toContain(productA._id);
    expect(listed).not.toContain(draftA._id);
    expect(await findPublicProduct(storeA._id, draftA.slug)).toBeNull();
  });

  it("never returns private fields (delivery link, Stripe account, owner)", async () => {
    const store = await findPublicStore(storeA.slug);
    const product = await findPublicProduct(storeA._id, productA.slug);
    const text = JSON.stringify({ store, product });
    expect(store?.name).toBe("Store A");
    expect(text).not.toContain("acct_secretA");
    expect(text).not.toContain(storeA.ownerId);
    expect(text).not.toContain("secret-download");
  });

  it("the checkout context does not carry the delivery link", async () => {
    const context = await loadCheckoutContext(storeA.slug, productA.slug);
    expect(context?.product.id).toBe(productA._id);
    expect(JSON.stringify(context)).not.toContain("secret-download");
  });
});

describe("NoSQL injection against the real database", () => {
  const attacks: unknown[] = [{ $ne: null }, { $gt: "" }, { $regex: ".*" }];

  it.each(attacks)("public lookups ignore %j", async (attack) => {
    expect(await findPublicStore(attack as string)).toBeNull();
    expect(await findPublicProduct(storeA._id, attack as string)).toBeNull();
    expect(await loadCheckoutContext(attack as string, attack as string)).toBeNull();
  });

  it("an array slug does not match a store", async () => {
    expect(await findPublicStore([storeA.slug] as unknown as string)).toBeNull();
    expect(await loadCheckoutContext([storeA.slug] as unknown as string, [productA.slug] as unknown as string)).toBeNull();
  });

  it("a buyer lookup with an operator object finds nothing", async () => {
    expect(await findPurchase("alice@example.com", { $ne: null } as unknown as string)).toBeNull();
    expect(await grantAccess("alice@example.com", { $ne: null } as unknown as string)).toEqual({ ok: false, reason: "not_found" });
  });
});
