import { z } from "zod";

import { COURSE_CATEGORIES, COURSE_LIMITS } from "@/lib/courses/settings";
import { parseMoneyToCents } from "@/lib/products/money";
import { isEmptyDoc, plainTextOf, richDocSchema } from "@/lib/products/rich-text";
import { PRODUCT_LIMITS, discountProblem, emailText, moneyField, text } from "@/lib/products/schemas";
import { cleanText } from "@/lib/products/text";
import { imageField } from "@/lib/stores/schemas";

// The course editor's Basic and Pricing steps (course flow G1). The client sends one JSON payload;
// every field is cleaned and checked again here, prices in the store's own currency (D-046).

const tags = z
  .array(z.string().transform((value) => cleanText(value).replace(/\s+/g, " ")))
  .max(COURSE_LIMITS.tagsMax * 2)
  .transform((values) => values.filter((value) => value !== ""))
  .pipe(
    z
      .array(z.string().max(COURSE_LIMITS.tag, { error: `Each tag: ${COURSE_LIMITS.tag} characters or fewer.` }))
      .max(COURSE_LIMITS.tagsMax, { error: `Add up to ${COURSE_LIMITS.tagsMax} tags.` })
      .refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, { error: "Each tag must be different." }),
  );

export const courseDetailsInputFor = (currency: string) =>
  z
    .object({
      title: text(PRODUCT_LIMITS.title, "Title").refine((value) => value !== undefined, { error: "Give your course a title." }),
      descriptionDoc: richDocSchema.nullable(),
      coverUrl: imageField("Cover"),
      category: z.union([z.enum(COURSE_CATEGORIES), z.literal("")], { error: "Pick a category from the list." }),
      tags,
      pricing: z.enum(["paid", "free"], { error: "Pick paid or free." }),
      price: z.string().max(20),
      discountOn: z.boolean(),
      salePrice: z.string().max(20),
      access: z.enum(["lifetime", "days"], { error: "Pick how long buyers keep access." }),
      accessDays: z.string().max(10),
      // Confirmation email (D-078), the same rules as a digital product's.
      emailSubject: emailText(PRODUCT_LIMITS.emailSubject, "Email subject"),
      emailBody: emailText(PRODUCT_LIMITS.emailBody, "Email message", { multiline: true }),
    })
    .transform((input, ctx) => {
      // Free courses cost 0 and have no discount; paid ones need a price above 0 within Stripe's limits.
      let priceCents = 0;
      let salePriceCents: number | null = null;
      if (input.pricing === "paid") {
        const price = moneyField("Price", currency).safeParse(input.price);
        if (!price.success) {
          ctx.addIssue({ code: "custom", path: ["price"], message: price.error.issues[0]?.message ?? "Enter a price." });
          return z.NEVER;
        }
        if (price.data === 0) {
          ctx.addIssue({ code: "custom", path: ["price"], message: "A paid course needs a price above 0. Pick Free to give it away." });
          return z.NEVER;
        }
        priceCents = price.data;
        if (input.discountOn) {
          const problem = discountProblem(priceCents, input.salePrice, currency);
          if (problem) {
            ctx.addIssue({ code: "custom", path: ["salePrice"], message: problem });
            return z.NEVER;
          }
          salePriceCents = parseMoneyToCents(input.salePrice, currency);
        }
      }

      let accessDays: number | null = null;
      if (input.access === "days") {
        const days = /^\d{1,4}$/.test(input.accessDays.trim()) ? Number(input.accessDays.trim()) : NaN;
        if (!(days >= 1 && days <= COURSE_LIMITS.accessDaysMax)) {
          ctx.addIssue({ code: "custom", path: ["accessDays"], message: `Access: enter 1 to ${COURSE_LIMITS.accessDaysMax} days, or pick Lifetime.` });
          return z.NEVER;
        }
        accessDays = days;
      }

      const doc = input.descriptionDoc && !isEmptyDoc(input.descriptionDoc) ? input.descriptionDoc : null;
      return {
        title: input.title as string,
        // The plain text is made here from the checked document, never taken from the client.
        description: doc ? plainTextOf(doc) : null,
        descriptionDoc: doc,
        coverUrl: input.coverUrl ?? null,
        priceCents,
        salePriceCents,
        course: { category: input.category === "" ? null : input.category, tags: input.tags, accessDays },
        emailSubject: input.emailSubject ?? null,
        emailBody: input.emailBody ?? null,
      };
    });

export type CourseDetailsInput = z.infer<ReturnType<typeof courseDetailsInputFor>>;
