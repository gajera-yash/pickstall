import { z } from "zod";

import type { ProductDoc } from "@/lib/db/collections";
import { parseMoneyToCents, priceProblem } from "@/lib/products/money";
import { cleanText } from "@/lib/products/text";

// Order bump rules (D-089). Pure and client-safe.

/** Products that can be offered as a bump: delivered without a booking. */
export const BUMP_TYPES: ProductDoc["type"][] = ["digital", "course"];
export const BUMP_HEADLINE_MAX = 120;

/** The creator's bump settings for one product, checked again on the server. Price in the store currency. */
export const bumpInputFor = (currency: string) =>
  z
    .object({
      enabled: z.boolean(),
      productId: z.union([z.uuid(), z.literal("")]),
      price: z.string().max(20),
      headline: z.string().max(BUMP_HEADLINE_MAX * 2),
    })
    .transform((input, ctx) => {
      if (!input.enabled) return null;
      if (!input.productId) {
        ctx.addIssue({ code: "custom", path: ["productId"], message: "Pick the product to offer." });
        return z.NEVER;
      }
      const cents = parseMoneyToCents(input.price, currency);
      const problem = cents === null ? "Enter a price." : cents === 0 ? "Enter a price above 0." : priceProblem(cents, currency, "Price");
      if (problem || cents === null) {
        ctx.addIssue({ code: "custom", path: ["price"], message: problem ?? "Enter a price." });
        return z.NEVER;
      }
      const headline = cleanText(input.headline).replace(/\s+/g, " ").slice(0, BUMP_HEADLINE_MAX);
      return { productId: input.productId, priceCents: cents, headline: headline || null };
    });

export type BumpInput = z.infer<ReturnType<typeof bumpInputFor>>;

/** What an order charges with a bump added: the bump's price on top of the main product's amounts. */
export function withBump(amount: { subtotalCents: number; discountCents: number; totalCents: number }, bumpPriceCents: number) {
  return { subtotalCents: amount.subtotalCents + bumpPriceCents, discountCents: amount.discountCents, totalCents: amount.totalCents + bumpPriceCents };
}
