import { ATTRIBUTION_FIELDS, attributionFrom } from "@/lib/analytics/attribution";

// Where a creator signed up from (D-119). Client-safe. The landing and signup pages note the link's
// personal lead code (`?ref=`, from our own outreach) and its UTM tags in sessionStorage (this tab
// only, no cookie); the signup forms send them as hidden fields and the server cleans them here
// before they are saved on the new store. Store pages use `?ref=` for creators' affiliates (D-113):
// that is a different storage key and never reaches these forms.

/** The query parameter carrying a lead's personal code on our marketing links. */
export const LEAD_REF_PARAM = "ref";

/** Hidden form fields the signup forms send: the lead code plus the order attribution fields. */
export const SIGNUP_SOURCE_FIELDS = { ref: "signupRef", ...ATTRIBUTION_FIELDS } as const;

/** The source used when a signup carries only a lead code: our own outreach links. */
export const OUTREACH_SOURCE = "outreach";

const LEAD_CODE = /^[a-z0-9][a-z0-9-]{2,31}$/;

/** A lead code, lower-cased; null for anything that is not 3-32 letters, digits or dashes. */
export function leadCodeOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return LEAD_CODE.test(code) ? code : null;
}

/** Where a store's owner came from, as saved on the store. Every field is cleaned and short. */
export type StoreAcquisition = { ref: string | null; source: string; medium: string | null; campaign: string | null; referrer: string | null };

/**
 * The acquisition of a signup from the form's hidden fields, or null for a direct one. A lead
 * code alone counts as our outreach. A visit from our own pages (`ownHost`) is not a source.
 */
export function acquisitionFrom(raw: { ref?: unknown; source?: unknown; medium?: unknown; campaign?: unknown; referrer?: unknown }, ownHost: string): StoreAcquisition | null {
  const ref = leadCodeOf(raw.ref);
  const visit = attributionFrom(raw, ownHost);
  if (visit) return { ref, ...visit };
  return ref ? { ref, source: OUTREACH_SOURCE, medium: null, campaign: null, referrer: null } : null;
}

/** The "Powered by" badge on store pages links home with the store as the campaign (D-119). */
export const BADGE_SOURCE = "pickstall_store";

/** The badge link: our landing page, tagged so a signup from it counts for that store. */
export function badgeHref(storeSlug?: string | null): string {
  const params = new URLSearchParams({ utm_source: BADGE_SOURCE, utm_medium: "badge" });
  if (storeSlug) params.set("utm_campaign", storeSlug);
  return `/?${params.toString()}`;
}

/** Reads the hidden fields from a submitted form. */
export function acquisitionFromForm(formData: FormData, ownHost: string): StoreAcquisition | null {
  return acquisitionFrom(
    {
      ref: formData.get(SIGNUP_SOURCE_FIELDS.ref),
      source: formData.get(SIGNUP_SOURCE_FIELDS.source),
      medium: formData.get(SIGNUP_SOURCE_FIELDS.medium),
      campaign: formData.get(SIGNUP_SOURCE_FIELDS.campaign),
      referrer: formData.get(SIGNUP_SOURCE_FIELDS.referrer),
    },
    ownHost,
  );
}
