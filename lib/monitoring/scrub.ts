// Removes secrets from URLs before an error report leaves the app (D-075). Some paths carry a token
// (the order-email link /welcome/<token>), others an id a stranger should not learn. Pure, so the
// Sentry setup on server, edge and browser share it, and it is unit-tested.

/** Path segments that are secrets or personal ids, replaced by a placeholder. */
const RULES: readonly { pattern: RegExp; replace: string }[] = [
  { pattern: /\/welcome\/[^/?#]+/g, replace: "/welcome/[token]" },
  { pattern: /\/library\/[0-9a-f-]{36}/gi, replace: "/library/[orderId]" },
  { pattern: /\/mock-pay\/[0-9a-f-]{36}/gi, replace: "/mock-pay/[orderId]" },
];

/** A URL or path with secrets replaced and the query string and fragment dropped. */
export function scrubUrl(value: string): string {
  let result = value.split(/[?#]/)[0] ?? "";
  for (const rule of RULES) result = result.replace(rule.pattern, rule.replace);
  return result;
}

type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  transaction?: string;
  user?: unknown;
  breadcrumbs?: { data?: Record<string, unknown> }[];
};

/**
 * Sentry `beforeSend` / `beforeSendTransaction`: scrubbed URL and transaction name, and no query
 * string, cookies, headers, body or user (on top of `dataCollection` being off). Same object back.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  delete event.user;
  for (const crumb of event.breadcrumbs ?? []) {
    for (const key of ["url", "from", "to"]) {
      const value = crumb.data?.[key];
      if (typeof value === "string" && crumb.data) crumb.data[key] = scrubUrl(value);
    }
  }
  return event;
}
