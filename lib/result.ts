/**
 * Typed result for server actions and `/lib` functions. `error` is safe to show to users.
 * `field` (optional) names the form field the error belongs to. `fields` (optional) holds every
 * field problem found at once (field name to message), so a form can show them all together;
 * `field` and `error` are then the first of them.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; field?: string; fields?: Record<string, string> };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, field?: string): Result<never> {
  return field ? { ok: false, error, field } : { ok: false, error };
}

/**
 * An error for several fields at once. The first entry becomes `error` and `field`. Returns a
 * plain error with `fallback` when `fields` is empty.
 */
export function fieldErrors(fields: Record<string, string>, fallback = "Check the form and try again."): Result<never> {
  const first = Object.entries(fields)[0];
  if (!first) return err(fallback);
  return { ok: false, error: first[1], field: first[0], fields };
}

/** The message for `field` in a failed result, from `fields` or from the single `field`. */
export function errorFor(result: { error: string; field?: string; fields?: Record<string, string> } | null | undefined, field: string): string | null {
  if (!result) return null;
  return result.fields?.[field] ?? (result.field === field ? result.error : null);
}
