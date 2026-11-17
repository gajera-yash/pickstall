import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry-options";

// Browser errors to Sentry (D-075), sent through our own /monitoring route (tunnelRoute) so the CSP
// stays `connect-src 'self'`. Off unless NEXT_PUBLIC_SENTRY_DSN is set. No replay, no widgets.
Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
