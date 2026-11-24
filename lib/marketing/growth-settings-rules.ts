import { z } from "zod";

import { cleanLeadNotes } from "@/lib/marketing/leads-rules";

// Growth settings (D-121). Client-safe: the settings form shows these limits; the server checks again.

export const VOICE_EXAMPLES_MAX = 4;
export const VOICE_EXAMPLE_MAX = 600;
export const FOLLOW_UP_AFTER_DAYS = 4;

export const DEFAULT_GROWTH_SETTINGS = { voiceExamples: [] as string[], dailyDraftLimit: 30, dailyContactTarget: 15 };

export type GrowthSettings = typeof DEFAULT_GROWTH_SETTINGS;

export const growthSettingsInput = z.object({
  voiceExamples: z
    .array(z.string().max(VOICE_EXAMPLE_MAX * 2))
    .max(VOICE_EXAMPLES_MAX)
    .transform((list) => list.map((text) => (cleanLeadNotes(text) ?? "").slice(0, VOICE_EXAMPLE_MAX)).filter(Boolean)),
  dailyDraftLimit: z.number().int().min(1, { error: "Allow at least 1 draft a day." }).max(200, { error: "Up to 200 drafts a day." }),
  dailyContactTarget: z.number().int().min(1, { error: "Suggest at least 1 creator a day." }).max(100, { error: "Up to 100 a day." }),
});
export type GrowthSettingsInput = z.input<typeof growthSettingsInput>;

/** The first word of a name, for "Hey Maya!". Null when there is no usable name. */
export function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{M}'-]/gu, "") ?? "";
  return first.length >= 2 ? first.slice(0, 40) : null;
}
