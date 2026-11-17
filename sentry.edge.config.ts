import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry-options";

// Edge runtime errors to Sentry (D-075). Off unless SENTRY_DSN is set.
Sentry.init(sentryOptions(process.env.SENTRY_DSN));
