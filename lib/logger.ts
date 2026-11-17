/* eslint-disable no-console -- this module is the single place allowed to write to the console */

import * as Sentry from "@sentry/nextjs";

// Minimal structured logger. Errors also go to Sentry (D-075) when a DSN is set; without one,
// Sentry is not started and the call does nothing.
// Never pass secrets, tokens, full emails or payment data in `context`.

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({ level, message, ...context, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") write("debug", message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => {
    write("error", message, context);
    Sentry.captureMessage(message, { level: "error", extra: context });
  },
};
