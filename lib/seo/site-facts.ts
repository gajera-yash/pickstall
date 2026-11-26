import { APP_NAME, FOUNDING_MONTHS, FOUNDING_SPOTS, PLANNED_PRICE_CENTS, SUPPORT_EMAIL, TRIAL_DAYS } from "@/lib/config";

// The facts every public page, the structured data and /llms.txt say about Pickstall (D-134).
// One source, so search engines and AI answer engines read the same, consistent description.
// Only what is live today; prices come from PLANNED_PRICE_CENTS.

export const SITE_URL = "https://www.pickstall.store";

/** The one-line definition repeated across the site (answer engines quote short, clear sentences). */
export const ONE_LINER = `${APP_NAME} is a link-in-bio store where creators sell digital products, online courses and coaching calls from one mobile page, with 0% transaction fees.`;

export const SHORT_PITCH = "A lower-cost Stan Store alternative with 0% transaction fees. No code needed; buyers pay into the creator's own PayPal account.";

export const PRICES = {
  starter: PLANNED_PRICE_CENTS.starter / 100,
  pro: PLANNED_PRICE_CENTS.pro / 100,
} as const;

export const KEY_FACTS = [
  `${APP_NAME} takes 0% of a creator's sales. PayPal's processing fees still apply.`,
  `Plans: Starter $${PRICES.starter} a month and Pro $${PRICES.pro} a month, billed in US dollars.`,
  `Every new store gets a ${TRIAL_DAYS}-day free trial with Pro features, no card needed. The first ${FOUNDING_SPOTS} founding creators get ${FOUNDING_MONTHS} months free.`,
  "Creators can sell digital downloads, online courses with video, quizzes and certificates, 1:1 coaching calls with booking, and free lead magnets.",
  "Growth tools: coupons, order bumps, upsells and downsells, email list and broadcasts, abandoned cart and review emails, affiliate tracking, Meta and Google pixels.",
  "Store design: 9 themes, 8 ready-made templates, custom colors, fonts and buttons, and page sections, with a live preview.",
  "Buyers pay into the creator's own PayPal account; Pickstall never holds creator money. The creator is the seller of record.",
] as const;

export const CONTACT_EMAIL = SUPPORT_EMAIL;

/**
 * AI search and answer engine crawlers (D-134), named in robots.txt so they are clearly welcome on the
 * public pages. A named group replaces the "*" group for that bot, so robots.ts repeats the private paths.
 */
export const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot"];
