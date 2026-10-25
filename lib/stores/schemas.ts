import { z } from "zod";

import { CURRENCIES } from "@/lib/config";
import { slugSchema } from "@/lib/slug";
import { hasControlChar } from "@/lib/text";

export const STORE_NAME_MAX_LENGTH = 60;
export const STORE_BIO_MAX_LENGTH = 200;

export const storeNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a store name." })
  .max(STORE_NAME_MAX_LENGTH, { error: `Use ${STORE_NAME_MAX_LENGTH} characters or fewer.` })
  .refine((value) => !hasControlChar(value), { error: "Remove the special characters from the name." });

/** Optional short bio. Line breaks are allowed; empty becomes undefined. */
export const storeBioSchema = z
  .string()
  .trim()
  .max(STORE_BIO_MAX_LENGTH, { error: `Use ${STORE_BIO_MAX_LENGTH} characters or fewer.` })
  .refine((value) => !hasControlChar(value, { allowNewlines: true }), { error: "Remove the special characters from the bio." })
  .transform((value) => (value === "" ? undefined : value));

/** Store basics step. Field order is the order errors are reported in. */
export const createStoreInput = z.object({
  name: storeNameSchema,
  username: slugSchema,
  currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
  bio: storeBioSchema,
});

export type CreateStoreInput = z.infer<typeof createStoreInput>;
