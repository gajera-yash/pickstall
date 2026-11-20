import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Sales attribution (D-112). Client-safe. A checkout carries where the buyer came from: the UTM
// tags of the link (utm_source, utm_medium, utm_campaign) and the site that sent them (its host
// only, never the full address). Nothing identifies the buyer; there is no cookie.

export const ATTRIBUTION_MAX = 100;

/** Where an order came from, as saved on the order. Every field is cleaned and short. */
export type OrderAttribution = { source: string; medium: string | null; campaign: string | null; referrer: string | null };

/** Form field names the checkout sends (filled in the browser from the visit). */
export const ATTRIBUTION_FIELDS = { source: "utmSource", medium: "utmMedium", campaign: "utmCampaign", referrer: "referrerHost" } as const;

const label = z
  .string()
  .max(ATTRIBUTION_MAX * 4)
  .transform((value) => cleanText(value).replace(/\s+/g, " ").trim().toLowerCase().slice(0, ATTRIBUTION_MAX))
  .catch("");

/** Known sites, so "l.instagram.com" and "instagram.com" count as one source. */
const KNOWN_SOURCES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)(t\.me|telegram\.org)$/, "telegram"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

/** A host name only ("www." removed), or null for anything that is not one. */
export function referrerHostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  let host = value.trim().toLowerCase();
  try {
    if (host.includes("/")) host = new URL(host).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".") ? host.slice(0, ATTRIBUTION_MAX) : null;
}

/** The source name for a referring site: a known name, or the host itself. */
export function sourceOfHost(host: string): string {
  return KNOWN_SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

/**
 * The attribution for an order from the checkout form, or null for a direct visit. The UTM source
 * wins over the referring site. Visits from the app's own pages (`ownHost`) do not count as a source.
 */
export function attributionFrom(raw: { source?: unknown; medium?: unknown; campaign?: unknown; referrer?: unknown }, ownHost: string): OrderAttribution | null {
  const text = (value: unknown) => label.parse(typeof value === "string" ? value : "") || null;
  const own = referrerHostOf(ownHost.split(":")[0] ?? "");
  const host = referrerHostOf(typeof raw.referrer === "string" ? raw.referrer : null);
  const referrer = host && host !== own && !(own && host.endsWith(`.${own}`)) ? host : null;
  const utmSource = text(raw.source);
  const source = utmSource ?? (referrer ? sourceOfHost(referrer) : null);
  if (!source) return null;
  return { source, medium: text(raw.medium), campaign: text(raw.campaign), referrer };
}

/** How a source is shown: "direct" for orders with none. */
export const DIRECT_SOURCE = "direct";
