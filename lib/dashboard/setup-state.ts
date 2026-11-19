import "server-only";

import { buildChecklist, type Checklist } from "@/lib/dashboard/checklist";
import { connectAvailable } from "@/lib/payments/connect";
import { testSellerAccountId } from "@/lib/payments/test-account";
import { listProducts, type CreatorProduct } from "@/lib/products/queries";
import type { CreatorStore } from "@/lib/stores/queries";

/**
 * True when this server can connect a store to Stripe (D-045): Connect OAuth (D-053), or the
 * test-mode seller account (D-034). The setup flow is the same either way.
 */
export function paymentsConnectable(): boolean {
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
export async function loadSetupState(store: Pick<CreatorStore, "id" | "bio" | "avatarUrl" | "stripeChargesEnabled" | "isPublished"> & Partial<Pick<CreatorStore, "profileSaved">>): Promise<SetupState> {
  const products = (await listProducts(store.id).catch(() => [])).filter((product) => product.status !== "archived");
  const checklist = buildChecklist({
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    profileSaved: store.profileSaved ?? false,
    chargesEnabled: store.stripeChargesEnabled,
    isPublished: store.isPublished,
    productCount: products.length,
    paymentsAvailable: paymentsConnectable(),
  });
  return { checklist, products };
}
