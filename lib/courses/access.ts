// A course's access period (D-054, D-057). Pure and client-safe.

const DAY_MS = 24 * 60 * 60 * 1000;

/** When access ends for an order paid at `paidAt`, or null for lifetime access. */
export function accessEndsAt(paidAt: Date, accessDays: number | null | undefined): Date | null {
  return accessDays ? new Date(paidAt.getTime() + accessDays * DAY_MS) : null;
}
