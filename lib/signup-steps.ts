/**
 * Order of the account wizard (docs/DECISIONS.md D-007). The progress bar is driven by this list.
 * Phase 3 inserts "plan" and "payment" before "activate" (platform billing); nothing else needs to change.
 */
export const SIGNUP_STEPS = ["account", "verify", "store", "activate"] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number];

/** 1-based position of a step and the total, for the progress bar and its text. */
export function stepPosition(step: SignupStep): { current: number; total: number } {
  return { current: SIGNUP_STEPS.indexOf(step) + 1, total: SIGNUP_STEPS.length };
}
