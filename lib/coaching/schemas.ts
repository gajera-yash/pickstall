import { z } from "zod";

import {
  COACHING_BUFFERS,
  COACHING_DURATIONS,
  COACHING_LIMITS,
  COACHING_NOTICE_HOURS,
  COACHING_WINDOW_DAYS,
  availabilityProblems,
  isValidTimeZone,
} from "@/lib/coaching/settings";
import { parseMoneyToCents } from "@/lib/products/money";
import { isEmptyDoc, plainTextOf, richDocSchema } from "@/lib/products/rich-text";
import { PRODUCT_LIMITS, discountProblem, moneyField, text } from "@/lib/products/schemas";
import { httpsUrlSchema, imageField } from "@/lib/stores/schemas";

// The coaching editor's payload (D-081). The client sends one JSON object; every field is cleaned
// and checked again here, prices in the store's own currency (D-046).

const oneOf = <T extends readonly number[]>(values: T, message: string) =>
  z.number({ error: message }).refine((value) => (values as readonly number[]).includes(value), { error: message });

const windowInput = z.object({
  day: z.number().int(),
  start: z.string().max(5),
  end: z.string().max(5),
});

export const coachingDetailsInputFor = (currency: string) =>
  z
    .object({
      title: text(PRODUCT_LIMITS.title, "Title").refine((value) => value !== undefined, { error: "Give your call a title." }),
      descriptionDoc: richDocSchema.nullable(),
      coverUrl: imageField("Cover"),
      durationMinutes: oneOf(COACHING_DURATIONS, "Pick a call length from the list."),
      timeZone: z.string().max(64).refine(isValidTimeZone, { error: "Pick your time zone from the list." }),
      weekly: z.array(windowInput).max(7 * COACHING_LIMITS.windowsPerDay, { error: `Use up to ${COACHING_LIMITS.windowsPerDay} time ranges a day.` }),
      bufferMinutes: oneOf(COACHING_BUFFERS, "Pick a break from the list."),
      minNoticeHours: oneOf(COACHING_NOTICE_HOURS, "Pick a notice time from the list."),
      bookingWindowDays: oneOf(COACHING_WINDOW_DAYS, "Pick how far ahead buyers can book."),
      meeting: z.enum(["link", "later"], { error: "Pick how buyers get the meeting link." }),
      meetingUrl: httpsUrlSchema("meeting link"),
      pricing: z.enum(["paid", "free"], { error: "Pick paid or free." }),
      price: z.string().max(20),
      discountOn: z.boolean(),
      salePrice: z.string().max(20),
    })
    .transform((input, ctx) => {
      const problem = availabilityProblems(input.weekly, input.durationMinutes)[0];
      if (problem) {
        ctx.addIssue({ code: "custom", path: ["weekly"], message: problem });
        return z.NEVER;
      }
      if (input.meeting === "link" && !input.meetingUrl) {
        ctx.addIssue({ code: "custom", path: ["meetingUrl"], message: "Add your meeting link, or pick “I'll send it later”." });
        return z.NEVER;
      }

      // Free calls cost 0 and have no discount; paid ones need a price above 0 within Stripe's limits.
      let priceCents = 0;
      let salePriceCents: number | null = null;
      if (input.pricing === "paid") {
        const price = moneyField("Price", currency).safeParse(input.price);
        if (!price.success) {
          ctx.addIssue({ code: "custom", path: ["price"], message: price.error.issues[0]?.message ?? "Enter a price." });
          return z.NEVER;
        }
        if (price.data === 0) {
          ctx.addIssue({ code: "custom", path: ["price"], message: "A paid call needs a price above 0. Pick Free to give it away." });
          return z.NEVER;
        }
        priceCents = price.data;
        if (input.discountOn) {
          const discount = discountProblem(priceCents, input.salePrice, currency);
          if (discount) {
            ctx.addIssue({ code: "custom", path: ["salePrice"], message: discount });
            return z.NEVER;
          }
          salePriceCents = parseMoneyToCents(input.salePrice, currency);
        }
      }

      const doc = input.descriptionDoc && !isEmptyDoc(input.descriptionDoc) ? input.descriptionDoc : null;
      // Sorted by day and start time, so the stored hours read in order.
      const weekly = [...input.weekly].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
      return {
        title: input.title as string,
        // The plain text is made here from the checked document, never taken from the client.
        description: doc ? plainTextOf(doc) : null,
        descriptionDoc: doc,
        coverUrl: input.coverUrl ?? null,
        priceCents,
        salePriceCents,
        coaching: {
          durationMinutes: input.durationMinutes,
          timeZone: input.timeZone,
          weekly,
          bufferMinutes: input.bufferMinutes,
          minNoticeHours: input.minNoticeHours,
          bookingWindowDays: input.bookingWindowDays,
          meetingUrl: input.meeting === "link" ? (input.meetingUrl ?? null) : null,
        },
      };
    });

export type CoachingDetailsInput = z.infer<ReturnType<typeof coachingDetailsInputFor>>;

/**
 * The time a buyer picked on the booking page (D-083) and their own time zone. Only the format is
 * checked here; the server then asks the slot engine whether that exact start is open.
 */
export const bookingInput = z.object({
  slotStart: z
    .string({ error: "Pick a time for your call." })
    .max(40, { error: "Pick a time for your call." })
    .refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/.test(value) && Number.isFinite(Date.parse(value)), { error: "Pick a time for your call." })
    .transform((value) => new Date(value)),
  buyerTimeZone: z
    .string()
    .max(64)
    .optional()
    .transform((value) => (value && isValidTimeZone(value) ? value : null)),
});
