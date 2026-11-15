// Can this store sell right now? (D-072, D-073). Pure, so pages, actions and tests share one rule.
// All plan gating goes through `can()` (CLAUDE.md 5); never compare plan names elsewhere.

import { TRIAL_DAYS, type PaidPlan } from "@/lib/config";
import type { StoreDoc } from "@/lib/db/collections";

/**
 * - `active`: a paid plan in good standing.
 * - `past_due`: a renewal payment failed and Stripe is retrying; the store stays open meanwhile.
 * - `founding` / `trial`: free periods. `paused`: none of the above.
 */
export type AccessState = "active" | "past_due" | "founding" | "trial" | "paused";

export type StoreAccess = {
  state: AccessState;
  /** When the current period ends (free period, or paid period); null when unknown. */
  endsAt: Date | null;
  /** Whole days left, rounded up (1 on the last day); null without an end date. */
  daysLeft: number | null;
  /** The paid plan, while it gives access. */
  plan: PaidPlan | null;
  /** A paid plan that the creator cancelled: it stays active until `endsAt`. */
  cancelsAtPeriodEnd: boolean;
};

export type StoreAccessFields = Pick<StoreDoc, "planTier" | "trialEndsAt" | "foundingEndsAt" | "billing">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stripe subscription statuses that give access. `past_due` keeps the store open while Stripe retries. */
const PAID_STATES: Record<string, "active" | "past_due" | undefined> = { active: "active", trialing: "active", past_due: "past_due" };

/** The trial end for a store created at `createdAt`. */
export function trialEndFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

function daysUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

function free(state: "founding" | "trial" | "paused", endsAt: Date | null, now: Date): StoreAccess {
  return { state, endsAt, daysLeft: endsAt ? daysUntil(endsAt, now) : null, plan: null, cancelsAtPeriodEnd: false };
}

/**
 * The store's access now. A paid plan in good standing wins; then a founding grant while it lasts;
 * then the free trial; afterwards the store is paused. A store from before D-072 without a trial
 * date stays open until the migration gives it one.
 */
export function storeAccess(store: StoreAccessFields, now: Date = new Date()): StoreAccess {
  const billing = store.billing;
  const paid = billing?.plan ? PAID_STATES[billing.status] : undefined;
  if (billing?.plan && paid) {
    const endsAt = billing.currentPeriodEnd ?? null;
    return { state: paid, endsAt, daysLeft: endsAt ? daysUntil(endsAt, now) : null, plan: billing.plan, cancelsAtPeriodEnd: billing.cancelAtPeriodEnd };
  }
  if (store.planTier === "founding" && store.foundingEndsAt && store.foundingEndsAt > now) return free("founding", store.foundingEndsAt, now);
  if (!store.trialEndsAt) return free("trial", null, now);
  if (store.trialEndsAt > now) return free("trial", store.trialEndsAt, now);
  return { ...free("paused", store.trialEndsAt, now), daysLeft: 0 };
}

/** What a paused store cannot do. Buyers' libraries and the dashboard always keep working. */
export type Feature = "sell" | "publish";

export function can(access: StoreAccess, feature: Feature): boolean {
  switch (feature) {
    case "sell":
    case "publish":
      return access.state !== "paused";
  }
}

export const PAUSED_MESSAGES = {
  publish: "Your store is paused because it has no active plan. Choose a plan to publish again.",
  checkout: "This store isn't taking orders right now. Please check back soon.",
} as const;
