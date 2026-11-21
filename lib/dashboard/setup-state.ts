import "server-only";

import { buildChecklist, type Checklist } from "@/lib/dashboard/checklist";
import { connectAvailable } from "@/lib/payments/connect";
import { activeProvider, paypalConnectAvailable } from "@/lib/payments/paypal-config";
import { testSellerAccountId } from "@/lib/payments/test-account";
import { isUnnamedDraft, listProducts, type CreatorProduct } from "@/lib/products/queries";
import type { CreatorStore } from "@/lib/stores/queries";

/**
 * True when this server can connect a store to its payment provider (D-045): PayPal by default
 * (D-118), or Stripe Connect OAuth (D-053) / the test-mode seller account (D-034) when Stripe is on.
 */
export function paymentsConnectable(): boolean {
  if (activeProvider() === "paypal") return paypalConnectAvailable();
  return connectAvailable() || testSellerAccountId() !== null;
}

export type SetupState = {
  checklist: Checklist;
  /** The store's products minus archived ones, newest first, for the preview and the product step. */
  products: CreatorProduct[];
};

/**
 * Setup progress for the creator's own store. `store` must come from requireCreator, so the product
 * query is already scoped to the session owner's store. An unreachable database reads as no products.
 */
export async function loadSetupState(store: Pick<CreatorStore, "id" | "bio" | "avatarUrl" | "chargesEnabled" | "isPublished"> & Partial<Pick<CreatorStore, "profileSaved">>): Promise<SetupState> {
  const products = (await listProducts(store.id).catch(() => [])).filter((product) => product.status !== "archived");
  const checklist = buildChecklist({
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    profileSaved: store.profileSaved ?? false,
    chargesEnabled: store.chargesEnabled,
    isPublished: store.isPublished,
    // An empty "Untitled product" fresh from Create is not a product yet (QA 2026-11), so the step
    // stays open until one is named. A store already live keeps counting it, so it is not locked again.
    productCount: store.isPublished ? products.length : products.filter((product) => !isUnnamedDraft(product)).length,
    paymentsAvailable: paymentsConnectable(),
  });
  return { checklist, products };
}
