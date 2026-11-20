// Can this store sell right now? (D-072, D-073). Pure, so pages, actions and tests share one rule.
// All plan gating goes through `can()` (CLAUDE.md 5); never compare plan names elsewhere.

import { APP_NAME, PLAN_LIMITS, SUPPORT_EMAIL, TRIAL_DAYS, type PaidPlan, type PlanFeature } from "@/lib/config";
import type { StoreDoc } from "@/lib/db/collections";

/**
 * - `active`: a paid plan in good standing.
 * - `past_due`: a renewal payment failed and Stripe is retrying; the store stays open meanwhile.
 * - `founding` / `trial`: free periods. `paused`: none of the above.
 */
export type AccessState = "active" | "past_due" | "founding" | "trial" | "paused" | "suspended";

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

export type StoreAccessFields = Pick<StoreDoc, "planTier" | "trialEndsAt" | "foundingEndsAt" | "billing"> & Partial<Pick<StoreDoc, "suspendedAt">>;

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
  // A platform admin suspended the store (D-105): it wins over any plan.
  if (store.suspendedAt) return { state: "suspended", endsAt: null, daysLeft: null, plan: store.billing?.plan ?? null, cancelsAtPeriodEnd: false };
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
export type Feature = "sell" | "publish" | "pixels" | PlanFeature;

/**
 * The limits that apply now (D-098): the paid plan's, or the trial's (Pro) for the free trial and
 * founding creators. A paused store keeps its numbers; it cannot sell or publish anyway.
 */
export function planLimits(access: Pick<StoreAccess, "plan">) {
  return PLAN_LIMITS[access.plan ?? "trial"];
}

export function can(access: StoreAccess, feature: Feature): boolean {
  switch (feature) {
    // Pro features (D-098): coaching calls and automations (welcome email, abandoned cart).
    case "coaching":
    case "automations":
    case "upsells":
      return isOpenState(access) && planLimits(access).features.includes(feature);
    case "sell":
    case "publish":
    // Pixels are in every plan (PRD F9: Starter and up; the trial mirrors Starter), not while paused.
    case "pixels":
      return isOpenState(access);
  }
}

/** Paused (no plan) and suspended (by an admin, D-105) stores can do nothing for buyers. */
function isOpenState(access: Pick<StoreAccess, "state">): boolean {
  return access.state !== "paused" && access.state !== "suspended";
}

/** Why publishing is off right now, for the creator. */
export function cannotPublishMessage(access: Pick<StoreAccess, "state">): string {
  return access.state === "suspended" ? SUSPENDED_MESSAGE : PAUSED_MESSAGES.publish;
}

export const SUSPENDED_MESSAGE = `Your store is suspended by the ${APP_NAME} team. Contact ${SUPPORT_EMAIL} to sort it out.`;

export const PAUSED_MESSAGES = {
  publish: "Your store is paused because it has no active plan. Choose a plan to publish again.",
  checkout: "This store isn't taking orders right now. Please check back soon.",
} as const;

/**
 * How many subscribed people the store's email list may hold (D-094, PRD F9): the paid plan's
 * limit, or the trial's while there is no paid plan.
 */
export function subscriberLimit(access: Pick<StoreAccess, "plan">): number {
  return planLimits(access).emailSubscribers;
}

export const AUTOMATIONS_PRO = "Automations (welcome email, abandoned cart) are part of Pro. Upgrade your plan to turn this on.";

/** Why a plan stops this course or call from being created or published, or null (D-098). */
export function planProblem(access: StoreAccess, input: { type: string; courses?: number }): string | null {
  if (input.type === "coaching" && !can(access, "coaching")) return "Coaching calls are part of Pro. Upgrade your plan to sell calls.";
  if (input.type === "course") {
    const max = planLimits(access).maxCourses;
    if (max !== null && (input.courses ?? 0) >= max) return `Your plan allows ${max} courses. Upgrade to Pro for unlimited courses.`;
  }
  return null;
}

/** Whether a new video still fits the plan's video hours (D-098). */
export function videoHoursProblem(access: Pick<StoreAccess, "plan">, usedSeconds: number): string | null {
  const hours = planLimits(access).videoHours;
  return usedSeconds >= hours * 3600 ? `You have used your plan's ${hours} hours of course video. Remove a video or upgrade your plan.` : null;
}
