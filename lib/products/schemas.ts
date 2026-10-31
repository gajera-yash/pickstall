import { z } from "zod";

import { CHECKOUT_QUESTIONS_MAX, PRICE_MAX_CENTS, PRICE_MIN_PAID_CENTS } from "@/lib/config";
import { parseMoneyToCents } from "@/lib/products/money";
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

const moneyField = (label: string) =>
  z
    .string()
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 19 or 19.99.` });
        return z.NEVER;
      }
      return cents;
    })
    .refine((cents) => cents <= PRICE_MAX_CENTS, { error: `${label}: the highest price is ${PRICE_MAX_CENTS / 100}.` })
    .refine((cents) => cents === 0 || cents >= PRICE_MIN_PAID_CENTS, { error: `${label}: use 0 (free) or at least ${PRICE_MIN_PAID_CENTS / 100}.` });

const optionalNumber = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || /^\d{1,4}$/.test(value), { error: `${label}: enter a whole number.` })
    .transform((value) => (value === "" ? undefined : Number(value)))
    .refine((value) => value === undefined || (value >= 1 && value <= max), { error: `${label}: use 1 to ${max}.` });

/** The whole product editor form. The client sends it as one JSON payload; every field is checked again here. */
export const productInput = z
  .object({
    title: text(PRODUCT_LIMITS.title, "Title").refine((value) => value !== undefined, { error: "Give your product a title." }),
    description: text(PRODUCT_LIMITS.description, "Description", { multiline: true }),
    coverUrl: imageField("Cover"),
    externalUrl: httpsUrlSchema("link"),
    pricingModel: z.enum(["fixed", "pwyw"], { error: "Pick a price type." }),
    price: moneyField("Price"),
    minPrice: z.string(),
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
    if (input.pricingModel === "pwyw") {
      const min = parseMoneyToCents(input.minPrice);
      if (min === null) ctx.addIssue({ code: "custom", path: ["minPrice"], message: "Minimum: enter an amount like 5 or 5.50." });
      else if (min > input.price) ctx.addIssue({ code: "custom", path: ["minPrice"], message: "The minimum can't be higher than the suggested price." });
      else if (min !== 0 && min < PRICE_MIN_PAID_CENTS)
        ctx.addIssue({ code: "custom", path: ["minPrice"], message: `Minimum: use 0 (free) or at least ${PRICE_MIN_PAID_CENTS / 100}.` });
    }
    const ids = input.questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["questions"], message: "Duplicate question." });
  })
  .transform(({ price, minPrice, ...rest }) => ({
    ...rest,
    priceCents: price,
    minPriceCents: rest.pricingModel === "pwyw" ? (parseMoneyToCents(minPrice) ?? 0) : null,
  }));

export type ProductInput = z.infer<typeof productInput>;

export const productStatusInput = z.enum(["draft", "published", "archived"]);
export const productIdInput = z.string().uuid();
