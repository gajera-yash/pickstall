import "server-only";

import { countProducts } from "@/lib/products/queries";

/**
 * True once the store has any product, archived ones included (D-046): prices are stored in the
 * currency's own units, so changing the currency afterwards would change what every price means.
 * `storeId` must come from requireCreator.
 */
export async function isCurrencyLocked(storeId: string): Promise<boolean> {
  const [active, archived] = await Promise.all([countProducts(storeId), countProducts(storeId, "archived")]);
  return active + archived > 0;
}
