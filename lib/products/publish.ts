import type { ProductDoc } from "@/lib/db/collections";
import { payableCents, type Priced } from "@/lib/products/pricing";

export type PublishCheck = { ok: true } | { ok: false; problems: string[] };

type Publishable = Pick<ProductDoc, "title" | "priceCents" | "salePriceCents" | "externalUrl"> & { fileCount?: number };

/**
 * Whether paid products may be published: the creator's Stripe account must be connected, or we
 * are in development where the MockProvider stands in (CLAUDE.md 7). In production only a
 * connected Stripe account counts.
 */
export function paymentsReady(store: { stripeChargesEnabled: boolean }, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return store.stripeChargesEnabled || nodeEnv !== "production";
}

/** True when buyers can pay anything for this product. */
export function isPaid(product: Priced): boolean {
  return payableCents(product) > 0;
}

/** Publish rules (PRD F3): a title, something to deliver, a valid price and payments for paid products. */
export function checkPublish(product: Publishable, store: { stripeChargesEnabled: boolean }, nodeEnv?: string): PublishCheck {
  const problems: string[] = [];
  if (!product.title.trim()) problems.push("Add a title.");
  if (!product.externalUrl && !(product.fileCount && product.fileCount > 0)) problems.push("Add a link or a file to deliver.");
  if (isPaid(product) && !paymentsReady(store, nodeEnv)) problems.push("Connect payments to publish a paid product.");
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
