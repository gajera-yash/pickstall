/**
 * Typed result for server actions and `/lib` functions. `error` is safe to show to users.
 * `field` (optional) names the form field the error belongs to.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; field?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, field?: string): Result<never> {
  return field ? { ok: false, error, field } : { ok: false, error };
}
