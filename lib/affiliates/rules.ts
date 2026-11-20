import { z } from "zod";

import { parseMoneyToCents } from "@/lib/products/money";
import { cleanText } from "@/lib/products/text";

// Affiliate tracking rules (D-113). Pure and client-safe. Tracking only: the platform never pays
// affiliates or holds money (PRD hard constraint). Creators pay them outside and record it here.

export const AFFILIATE_LIMITS = { perStore: 50, name: 80, note: 200, percentMin: 1, percentMax: 90 } as const;
export const AFFILIATE_CODE = /^[a-z0-9][a-z0-9-]{2,19}$/;
/** The link parameter: `?ref=asha`. */
export const AFFILIATE_PARAM = "ref";
/** The checkout form field that carries it. */
export const AFFILIATE_FIELD = "affiliateRef";
/** The most a single recorded payment can be (100 million in the smallest unit). */
const PAYOUT_MAX_CENTS = 100_000_000;

/** "  Asha " -> "asha". */
export function normalizeAffiliateCode(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A code from a link or form, or null when it cannot be one. */
export function affiliateCodeOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = normalizeAffiliateCode(raw);
  return AFFILIATE_CODE.test(code) ? code : null;
}

/** The commission on one order: the amount kept after partial refunds, times the rate, rounded down. */
export function commissionCents(totalCents: number, refundedCents: number, percent: number): number {
  const net = Math.max(0, totalCents - Math.max(0, refundedCents));
  return Math.floor((net * percent) / 100);
}

const name = z
  .string()
  .max(AFFILIATE_LIMITS.name * 4)
  .transform((value) => cleanText(value).replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, { error: "Enter the affiliate's name." }).max(AFFILIATE_LIMITS.name, { error: `Name: ${AFFILIATE_LIMITS.name} characters or fewer.` }));

/** The creator's "Add affiliate" form, checked again on the server. */
export const affiliateInput = z.object({
  name,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .transform((value) => (value === "" ? null : value))
    .pipe(z.email({ error: "Enter a valid email address, or leave it empty." }).nullable()),
  code: z
    .string()
    .max(40)
    .transform(normalizeAffiliateCode)
    .pipe(z.string().regex(AFFILIATE_CODE, { error: "Code: 3-20 letters, numbers or dashes, starting with a letter or number." })),
  commissionPercent: z
    .number({ error: "Commission: enter a number." })
    .int({ error: "Commission: a whole number." })
    .min(AFFILIATE_LIMITS.percentMin, { error: `Commission: ${AFFILIATE_LIMITS.percentMin}% to ${AFFILIATE_LIMITS.percentMax}%.` })
    .max(AFFILIATE_LIMITS.percentMax, { error: `Commission: ${AFFILIATE_LIMITS.percentMin}% to ${AFFILIATE_LIMITS.percentMax}%.` }),
});
export type AffiliateInput = z.infer<typeof affiliateInput>;

/** A payment the creator made to an affiliate outside the platform, in the store's currency. */
export const payoutInputFor = (currency: string) =>
  z.object({
    amount: z.string().max(20).transform((value, ctx) => {
      const cents = parseMoneyToCents(value, currency);
      if (cents === null || cents <= 0 || cents > PAYOUT_MAX_CENTS) {
        ctx.addIssue({ code: "custom", message: "Enter the amount you paid." });
        return z.NEVER;
      }
      return cents;
    }),
    note: z
      .string()
      .max(AFFILIATE_LIMITS.note * 4)
      .transform((value) => cleanText(value).replace(/\s+/g, " ").trim())
      .pipe(z.string().max(AFFILIATE_LIMITS.note, { error: `Note: ${AFFILIATE_LIMITS.note} characters or fewer.` }))
      .transform((value) => (value === "" ? null : value)),
  });
