// Can this store sell right now? (D-072). Pure, so pages, actions and tests share one rule. All plan
// gating goes through `can()` (CLAUDE.md 5); never compare plan names elsewhere.

import { TRIAL_DAYS } from "@/lib/config";
import type { StoreDoc } from "@/lib/db/collections";

export type AccessState = "trial" | "founding" | "paused";

export type StoreAccess = {
  state: AccessState;
  /** When the current free period ends; null for an older store without a trial date yet. */
  endsAt: Date | null;
  /** Whole days left, rounded up (1 on the last day); null without an end date. */
  daysLeft: number | null;
};

export type StoreAccessFields = Pick<StoreDoc, "planTier" | "trialEndsAt" | "foundingEndsAt">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The trial end for a store created at `createdAt`. */
export function trialEndFrom(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

function daysUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/**
 * The store's access now. A founding grant wins while it lasts; then the free trial; afterwards the
 * store is paused until it has a paid plan (Phase C). A store from before D-072 without a trial date
 * stays open until the migration gives it one.
 */
export function storeAccess(store: StoreAccessFields, now: Date = new Date()): StoreAccess {
  if (store.planTier === "founding" && store.foundingEndsAt && store.foundingEndsAt > now) {
    return { state: "founding", endsAt: store.foundingEndsAt, daysLeft: daysUntil(store.foundingEndsAt, now) };
  }
  if (!store.trialEndsAt) return { state: "trial", endsAt: null, daysLeft: null };
  if (store.trialEndsAt > now) return { state: "trial", endsAt: store.trialEndsAt, daysLeft: daysUntil(store.trialEndsAt, now) };
  return { state: "paused", endsAt: store.trialEndsAt, daysLeft: 0 };
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
  publish: "Your free trial has ended, so your store is paused. Choose a plan to publish again.",
  checkout: "This store isn't taking orders right now. Please check back soon.",
} as const;
