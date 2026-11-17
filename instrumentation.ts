import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook (D-075): starts Sentry for the runtime in use and reports errors from
// server components, route handlers and server actions.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
