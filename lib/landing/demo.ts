// Pure logic for the marketing landing page (D-039): the "Build your stall" demo and the fee
// calculator. Everything here is client-safe and unit-tested. Money is integer cents.

export const STALL_NAME_MAX = 30;
export const DEFAULT_STALL_NAME = "Maya's Money Studio";

export type DemoProduct = { id: string; title: string; priceCents: number };

/** Phase 1 sells digital products only, so the demo shelf holds digital products. */
export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  { id: "guide", title: "PDF guide", priceCents: 1900 },
  { id: "templates", title: "Template pack", priceCents: 2900 },
  { id: "presets", title: "Preset bundle", priceCents: 1500 },
  { id: "workbook", title: "Budget workbook", priceCents: 900 },
];

/** What the visitor types as a stall name: no control characters, single spaces, at most 30 characters. */
export function cleanStallName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trimStart()
    .slice(0, STALL_NAME_MAX);
}

/** Initials for the demo avatar ("Maya's Money Studio" -> "MM"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word.replace(/[^\p{L}\p{N}]/gu, "").charAt(0));
  return letters.join("").toUpperCase() || "P";
}

/**
 * The product the next demo sale is for: the shelf rotates through what is stocked, so repeated sales
 * show different items. Returns null when the shelf is empty.
 */
export function nextSale(stocked: readonly DemoProduct[], salesSoFar: number): DemoProduct | null {
  if (stocked.length === 0) return null;
  return stocked[salesSoFar % stocked.length] ?? null;
}

export const CALCULATOR = {
  minCents: 50_000,
  maxCents: 2_000_000,
  stepCents: 25_000,
  defaultCents: 300_000,
  /** An assumed example rate for "platforms that take a cut", never a quote for a real platform. */
  assumedRate: 0.1,
} as const;

export type FeeComparison = {
  salesCents: number;
  /** What a per-sale fee at the assumed rate would take each month. */
  cutCents: number;
  /** Pickstall's platform fee on those sales: always zero. */
  platformFeeCents: 0;
  /** What the cut would add up to over a year. */
  yearlyCutCents: number;
};

/** Monthly sales against a per-sale cut at the assumed rate. Card processing fees apply to both and are left out. */
export function compareFees(salesCents: number, rate: number = CALCULATOR.assumedRate): FeeComparison {
  const sales = Math.max(0, Math.round(salesCents));
  const cutCents = Math.round(sales * rate);
  return { salesCents: sales, cutCents, platformFeeCents: 0, yearlyCutCents: cutCents * 12 };
}

/** Clamps and snaps a slider value to the calculator's range and step. */
export function snapSales(cents: number): number {
  const { minCents, maxCents, stepCents } = CALCULATOR;
  if (!Number.isFinite(cents)) return CALCULATOR.defaultCents;
  const snapped = Math.round(cents / stepCents) * stepCents;
  return Math.min(maxCents, Math.max(minCents, snapped));
}

/** Whole-dollar money for big marketing numbers ("$3,000"). */
export function formatWholeDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

/** What a cheaper monthly plan saves over a year, in cents (never negative). */
export function yearlySavingsCents(theirMonthlyCents: number, ourMonthlyCents: number): number {
  return Math.max(0, theirMonthlyCents - ourMonthlyCents) * 12;
}

/** Our price as a share of theirs, rounded down to a whole percent ("39% of the price"). */
export function priceShare(ourMonthlyCents: number, theirMonthlyCents: number): number {
  if (theirMonthlyCents <= 0) return 100;
  return Math.floor((ourMonthlyCents / theirMonthlyCents) * 100);
}
