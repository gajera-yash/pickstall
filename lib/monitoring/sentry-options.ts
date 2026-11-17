// Shared Sentry settings (D-075). Error reports only: no session replay, no feedback widget, no
// personal data (user info, cookies, headers, bodies and query strings are off, and URLs are
// scrubbed). Without a DSN, Sentry is not started at all.

import { scrubEvent } from "@/lib/monitoring/scrub";

export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NODE_ENV,
    // A small share of requests is traced for performance; errors are always reported.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
