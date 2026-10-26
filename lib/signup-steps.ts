/**
 * Signup is two steps (docs/DECISIONS.md D-008): details, then the email code. The username step
 * (Google users, taken usernames) counts as the second step. The progress bar is driven by this list.
 */
export const SIGNUP_STEPS = ["details", "code"] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number];

/** 1-based position of a step and the total, for the progress bar and its text. */
export function stepPosition(step: SignupStep): { current: number; total: number } {
  return { current: SIGNUP_STEPS.indexOf(step) + 1, total: SIGNUP_STEPS.length };
}
