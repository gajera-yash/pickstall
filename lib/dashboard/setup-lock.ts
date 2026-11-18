// Dashboard lock during first-run setup (docs/DECISIONS.md D-079). Until the creator finishes
// setup, My Store shows the onboarding screen and the other sections are locked, in the nav and on
// the server. Pure rules here, so they can be unit-tested; the server guard is in ./setup-gate.ts.

import type { DashboardSectionId } from "@/lib/dashboard/nav";

export const LOCKED_HINT = "Finish setting up your store first";

export type UnlockInput = {
  /** Every setup step that counts on this server is done (buildChecklist().complete). */
  setupComplete: boolean;
  /** The store has at least one paid or refunded order. */
  hasOrders: boolean;
};

/**
 * The dashboard opens once setup is complete. A store that has ever sold stays open even if a step
 * is undone later (unpublished, bio removed), so a creator never loses access to their orders.
 */
export function isDashboardUnlocked({ setupComplete, hasOrders }: UnlockInput): boolean {
  return setupComplete || hasOrders;
}

// Pages that stay open while locked: My Store, the setup wizard, the product editor (the "Add your
// first product" step opens it), and the account and plan pages (sign out, delete account, billing).
const OPEN_WHILE_LOCKED: readonly RegExp[] = [
  /^\/dashboard$/,
  /^\/dashboard\/setup$/,
  /^\/dashboard\/products\/[^/]+$/,
  /^\/dashboard\/products\/[^/]+\/preview$/,
  /^\/dashboard\/settings\/account$/,
  /^\/dashboard\/settings\/plan$/,
];

/** True when `pathname` may be opened while the dashboard is locked. Query and hash are ignored. */
export function isPathOpenWhileLocked(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  return OPEN_WHILE_LOCKED.some((pattern) => pattern.test(path));
}

/** Nav sections are locked while setup is incomplete, except My Store. */
export function isSectionLocked(section: DashboardSectionId, unlocked: boolean): boolean {
  return !unlocked && section !== "store";
}
