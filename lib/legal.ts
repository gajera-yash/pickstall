// Who runs Pickstall, for the legal pages and the grievance contact (D-074). One place to fill in.
// Values in [BRACKETS] are not known yet: the founder must replace them before launch, and the legal
// pages show a "draft" notice while any remain. Keep the founder's real details out of git history if
// they are private: an address can also be a business or PO box address.

import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const LEGAL = {
  /** The person or registered business that runs Pickstall. Stripe India needs a registered business for live payments. */
  operatorName: "[YOUR FULL LEGAL NAME OR REGISTERED BUSINESS NAME]",
  /** City and state for the courts clause and the contact block. */
  city: "[CITY]",
  state: "[STATE]",
  country: "India",
  /** A postal address for legal notices and email footers. */
  postalAddress: "[POSTAL ADDRESS]",
  contactEmail: SUPPORT_EMAIL,
  /** Grievance Officer (IT Rules 2021, Rule 3(2)) and contact for data requests (DPDP Act 2023). */
  grievanceOfficer: { name: "[GRIEVANCE OFFICER NAME]", email: SUPPORT_EMAIL },
  /** Date the current texts took effect, and the version stored when someone accepts the Terms. */
  effectiveDate: "November 15, 2026",
  termsVersion: "2026-11-15",
} as const;

export const BRAND = APP_NAME;

/** The fields still holding a [PLACEHOLDER]. */
export function legalPlaceholders(legal: Record<string, unknown> = LEGAL): string[] {
  const missing: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string" && /\[[A-Z ]+\]/.test(value)) missing.push(path);
    else if (value && typeof value === "object") for (const [key, inner] of Object.entries(value)) walk(inner, path ? `${path}.${key}` : key);
  };
  walk(legal, "");
  return missing;
}

/** The legal pages, in footer order. */
export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refunds and cancellation" },
  { href: "/acceptable-use", label: "Acceptable use" },
  { href: "/copyright", label: "Copyright complaints" },
  { href: "/cookies", label: "Cookies" },
] as const;
