import { z } from "zod";

import { BUYER_NAME_MAX } from "@/lib/config";
import { optionalPhoneSchema } from "@/lib/phone";
import { cleanText } from "@/lib/products/text";

/** The buyer's own details at checkout. Answers and the price are checked separately against the product. */
export const buyerInput = z.object({
  name: z
    .string()
    .transform((value) => cleanText(value))
    .pipe(z.string().min(1, { error: "Enter your name." }).max(BUYER_NAME_MAX, { error: `Use ${BUYER_NAME_MAX} characters or fewer.` })),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Enter a valid email address." })),
  phone: optionalPhoneSchema,
});

export type BuyerInput = z.infer<typeof buyerInput>;
