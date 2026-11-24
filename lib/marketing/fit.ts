import type { LeadTool } from "@/lib/marketing/leads-rules";

// How well a lead fits Pickstall today (D-121), from the founder's own list only: no AI, nothing
// stored. The beachhead in MARKETING_PLAN.md section 2: creators on Stan, Linktree, Beacons or
// Gumroad, 1K-50K followers, selling to buyers in the US, UK or Canada.

export type FitInput = { tool: LeadTool; followers: number | null; country: string | null; topic: string | null };
export type Fit = { score: number; reasons: string[]; warning: string | null };

const SWITCH_TOOLS: Partial<Record<LeadTool, [number, string]>> = {
  stan: [30, "Uses Stan Store: Pickstall Pro is $39 vs $99"],
  gumroad: [30, "Uses Gumroad: no 10% fee on Pickstall"],
  beacons: [25, "Uses Beacons: a link-in-bio store already"],
  linktree: [20, "Uses Linktree: ready for a store"],
  koji: [20, "Uses Koji: a link-in-bio store already"],
  payhip: [15, "Uses Payhip"],
  podia: [10, "Uses Podia"],
  kajabi: [10, "Uses Kajabi: price may matter"],
  teachable: [10, "Uses Teachable: price may matter"],
};

const CORE_MARKETS = /^(us|usa|u\.s\.a?\.?|united states( of america)?|america|uk|u\.k\.|united kingdom|england|scotland|wales|great britain|gb|canada|ca)$/i;
const INDIA = /^(in|india|bharat)$/i;

/** A 0-100 score with the reasons behind it, and a warning when PayPal limits get in the way. */
export function leadFit(input: FitInput): Fit {
  let score = 0;
  const reasons: string[] = [];

  const tool = SWITCH_TOOLS[input.tool];
  if (tool) {
    score += tool[0];
    reasons.push(tool[1]);
  } else if (input.tool === "none") {
    score += 5;
    reasons.push("No store yet");
  }

  const followers = input.followers;
  if (followers !== null) {
    if (followers >= 1_000 && followers <= 50_000) {
      score += 25;
      reasons.push("1K-50K followers: likely to reply");
    } else if (followers > 50_000 && followers <= 250_000) {
      score += 15;
      reasons.push("50K-250K followers");
    } else if (followers > 250_000) {
      score += 5;
      reasons.push("Over 250K followers: less likely to reply");
    } else {
      score += 5;
      reasons.push("Under 1K followers");
    }
  }

  const country = input.country?.trim() ?? "";
  let warning: string | null = null;
  if (CORE_MARKETS.test(country)) {
    score += 20;
    reasons.push("US, UK or Canada");
  } else if (INDIA.test(country)) {
    score += 5;
    warning = "In India: a PayPal India account cannot take payments from buyers in India. Check they sell to buyers abroad.";
  } else if (country) {
    score += 10;
  }

  if (input.topic) {
    score += 10;
    reasons.push(`Teaches ${input.topic}`);
  }

  return { score: Math.min(score, 100), reasons, warning };
}

/** Followers as a range for the AI writer, so the exact number never leaves our database. */
export function followerBand(followers: number | null): string | null {
  if (followers === null) return null;
  if (followers < 1_000) return "under 1K";
  if (followers < 10_000) return "1K-10K";
  if (followers < 50_000) return "10K-50K";
  if (followers < 250_000) return "50K-250K";
  return "over 250K";
}
