import { z } from "zod";

import type { ProductDoc } from "@/lib/db/collections";
import { parseMoneyToCents, priceProblem } from "@/lib/products/money";
import { cleanText } from "@/lib/products/text";

// Upsell rules (D-099). Pure and client-safe.

/** Products that can be offered after a purchase: delivered without a booking. */
export const UPSELL_TYPES: ProductDoc["type"][] = ["digital", "course"];
export const UPSELL_HEADLINE_MAX = 120;
/** How long after the purchase the offer is shown. */
export const UPSELL_WINDOW_MS = 2 * 60 * 60 * 1000;

/** The creator's upsell settings for one product, checked again on the server. Free is allowed. */
export const upsellInputFor = (currency: string) =>
  z
    .object({
      enabled: z.boolean(),
      productId: z.union([z.uuid(), z.literal("")]),
      price: z.string().max(20),
      headline: z.string().max(UPSELL_HEADLINE_MAX * 2),
    })
    .transform((input, ctx) => {
      if (!input.enabled) return null;
      if (!input.productId) {
        ctx.addIssue({ code: "custom", path: ["productId"], message: "Pick the product to offer." });
        return z.NEVER;
      }
      const cents = parseMoneyToCents(input.price, currency);
      const problem = cents === null ? "Enter a price (0 for free)." : cents === 0 ? null : priceProblem(cents, currency, "Price");
      if (problem || cents === null) {
        ctx.addIssue({ code: "custom", path: ["price"], message: problem ?? "Enter a price." });
        return z.NEVER;
      }
      const headline = cleanText(input.headline).replace(/\s+/g, " ").slice(0, UPSELL_HEADLINE_MAX);
      return { productId: input.productId, priceCents: cents, headline: headline || null };
    });

export type UpsellInput = z.infer<ReturnType<typeof upsellInputFor>>;

/** Whether the offer is still open for a purchase paid at `paidAt`. */
export function upsellWindowOpen(paidAt: Date | null, now: Date): boolean {
  return paidAt !== null && now.getTime() - paidAt.getTime() <= UPSELL_WINDOW_MS && now.getTime() >= paidAt.getTime() - 60_000;
}
