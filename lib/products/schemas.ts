import { z } from "zod";

import { CHECKOUT_QUESTIONS_MAX } from "@/lib/config";
import { parseMoneyToCents, priceDecimals, priceProblem } from "@/lib/products/money";
import { isEmptyDoc, plainTextOf, richDocSchema } from "@/lib/products/rich-text";
import { cleanText, isSensitiveQuestion, unknownEmailVariables } from "@/lib/products/text";
import { httpsUrlSchema, imageField } from "@/lib/stores/schemas";

export const PRODUCT_LIMITS = {
  title: 80,
  description: 2000,
  buttonText: 24,
  headline: 80,
  thankYou: 500,
  emailSubject: 120,
  emailBody: 2000,
  questionLabel: 120,
  option: 60,
  optionsMax: 10,
  downloadLimitMax: 100,
} as const;

/** Creator text: cleaned of tags and control characters, length-limited. Empty becomes undefined. */
function text(max: number, label: string, options: { multiline?: boolean } = {}) {
  return z
    .string()
    .transform((value) => cleanText(value, options))
    .pipe(z.string().max(max, { error: `${label}: use ${max} characters or fewer.` }))
    .transform((value) => (value === "" ? undefined : value));
}

const emailText = (max: number, label: string, options: { multiline?: boolean } = {}) =>
  text(max, label, options).refine((value) => value === undefined || unknownEmailVariables(value).length === 0, {
    error: `${label}: only {{customer_name}}, {{product_title}} and {{download_link}} can be used.`,
  });

export const questionInput = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    label: z
      .string()
      .transform((value) => cleanText(value))
      .pipe(
        z
          .string()
          .min(1, { error: "Write the question." })
          .max(PRODUCT_LIMITS.questionLabel, { error: `Use ${PRODUCT_LIMITS.questionLabel} characters or fewer.` })
          .refine((value) => !isSensitiveQuestion(value), { error: "Don't ask for card numbers, IDs or passwords." }),
      ),
    kind: z.enum(["text", "long_text", "dropdown", "checkbox"]),
    required: z.boolean(),
    options: z.array(z.string().transform((value) => cleanText(value))).max(PRODUCT_LIMITS.optionsMax),
  })
  .superRefine((question, ctx) => {
    if (question.kind !== "dropdown") return;
    const options = question.options.filter((option) => option !== "");
    if (options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two choices." });
    if (options.some((option) => option.length > PRODUCT_LIMITS.option))
      ctx.addIssue({ code: "custom", path: ["options"], message: `Each choice: ${PRODUCT_LIMITS.option} characters or fewer.` });
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length)
      ctx.addIssue({ code: "custom", path: ["options"], message: "Each choice must be different." });
  })
  .transform((question) => ({
    ...question,
    options: question.kind === "dropdown" ? question.options.filter((option) => option !== "") : [],
  }));

/** An example amount for error messages, in the currency's own format ("19.99" or "500"). */
const example = (currency: string) => (priceDecimals(currency) === 0 ? "500" : "19.99");

/** A price typed by the creator, in this store currency's amount units (D-046), within Stripe's limits. */
const moneyField = (label: string, currency: string) =>
  z.string().transform((value, ctx) => {
    const cents = parseMoneyToCents(value, currency);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `${label}: enter an amount like ${example(currency)}.` });
      return z.NEVER;
    }
    const problem = priceProblem(cents, currency, label);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return cents;
  });

const optionalNumber = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^\d{1,4}$/.test(value), { error: `${label}: enter a whole number.` })
    .transform((value) => (value === "" ? undefined : Number(value)))
    .refine((value) => value === undefined || (value >= 1 && value <= max), { error: `${label}: use 1 to ${max}.` });

/**
 * The whole product editor form for a store in `currency`. The client sends it as one JSON payload;
 * every field is checked again here, prices in the store's currency.
 */
export const productInputFor = (currency: string) =>
  z
  .object({
    title: text(PRODUCT_LIMITS.title, "Title").refine((value) => value !== undefined, { error: "Give your product a title." }),
    /** Rich text from the editor (D-049), checked against the allow-list. Null clears it. */
    descriptionDoc: richDocSchema.nullable(),
    coverUrl: imageField("Cover"),
    externalUrl: httpsUrlSchema("link"),
    price: moneyField("Price", currency),
    /** Discount toggle (D-047): when on, buyers pay `salePrice` instead of `price`. */
    discountOn: z.boolean(),
    salePrice: z.string().max(20),
    buttonText: text(PRODUCT_LIMITS.buttonText, "Button text"),
    downloadLimit: optionalNumber(PRODUCT_LIMITS.downloadLimitMax, "Download limit"),
    headline: text(PRODUCT_LIMITS.headline, "Checkout headline"),
    askPhone: z.boolean(),
    questions: z.array(questionInput).max(CHECKOUT_QUESTIONS_MAX, { error: `Add up to ${CHECKOUT_QUESTIONS_MAX} questions.` }),
    thankYou: text(PRODUCT_LIMITS.thankYou, "Thank-you message", { multiline: true }),
    redirectUrl: httpsUrlSchema("link"),
    emailSubject: emailText(PRODUCT_LIMITS.emailSubject, "Email subject"),
    emailBody: emailText(PRODUCT_LIMITS.emailBody, "Email message", { multiline: true }),
  })
  .superRefine((input, ctx) => {
    if (input.discountOn) {
      const sale = parseMoneyToCents(input.salePrice, currency);
      if (input.price === 0) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "A free product can't have a discount." });
      else if (sale === null) ctx.addIssue({ code: "custom", path: ["salePrice"], message: `Discounted price: enter an amount like ${example(currency)}.` });
      else if (sale >= input.price) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "The discounted price must be lower than the price." });
      else {
        const problem = sale === 0 ? "Discounted price: use an amount above 0, or make the product free." : priceProblem(sale, currency, "Discounted price");
        if (problem) ctx.addIssue({ code: "custom", path: ["salePrice"], message: problem });
      }
    }
    const ids = input.questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["questions"], message: "Duplicate question." });
  })
  .transform(({ price, discountOn, salePrice, descriptionDoc, ...rest }) => ({
    ...rest,
    // The plain text is made here from the checked document, never taken from the client.
    description: descriptionDoc && !isEmptyDoc(descriptionDoc) ? plainTextOf(descriptionDoc) : undefined,
    descriptionDoc: descriptionDoc && !isEmptyDoc(descriptionDoc) ? descriptionDoc : null,
    priceCents: price,
    salePriceCents: discountOn ? parseMoneyToCents(salePrice, currency) : null,
  }));

export type ProductInput = z.infer<ReturnType<typeof productInputFor>>;

export const productStatusInput = z.enum(["draft", "published", "archived"]);
export const productIdInput = z.string().uuid();
