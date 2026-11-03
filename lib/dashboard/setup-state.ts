import "server-only";

import { buildChecklist, type Checklist } from "@/lib/dashboard/checklist";
import { testSellerAccountId } from "@/lib/payments/test-account";
import { listProducts, type CreatorProduct } from "@/lib/products/queries";
import type { CreatorStore } from "@/lib/stores/queries";

/**
 * True when this server can connect a store to Stripe (D-045). Today that is the test-mode seller
 * account (D-034); Connect OAuth adds itself here later, and the setup flow stays the same.
 */
export function paymentsConnectable(): boolean {
  return testSellerAccountId() !== null;
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
export async function loadSetupState(store: Pick<CreatorStore, "id" | "bio" | "avatarUrl" | "stripeChargesEnabled" | "isPublished">): Promise<SetupState> {
  const products = (await listProducts(store.id).catch(() => [])).filter((product) => product.status !== "archived");
  const checklist = buildChecklist({
    bio: store.bio,
    avatarUrl: store.avatarUrl,
    chargesEnabled: store.stripeChargesEnabled,
    isPublished: store.isPublished,
    productCount: products.length,
    paymentsAvailable: paymentsConnectable(),
  });
  return { checklist, products };
}
