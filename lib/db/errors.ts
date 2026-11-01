// Turns a database failure into a plain next step for the developer (D-041). Used only in
// development: production users always get the generic message, never error details.

const GENERIC = "Couldn't check that username. Try again.";

/** A short fix for common MongoDB connection failures, or null when the error is something else. */
export function databaseHint(error: unknown): string | null {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;

  if (/Missing or invalid environment variables/.test(message)) {
    return ".env.local is missing values. Run `pnpm doctor` in the terminal to see which.";
  }
  if (code === 18 || /bad auth|Authentication failed/i.test(message)) {
    return "MongoDB rejected the username or password in MONGODB_URI. Put the current connection string in .env.local and restart `pnpm dev`.";
  }
  if (/querySrv|ENOTFOUND|EREFUSED/i.test(message)) {
    return "This PC can't look up the MongoDB address (DNS). Run `pnpm doctor` for the fix.";
  }
  if (name === "MongoServerSelectionError" || /Server selection timed out|ECONNRESET|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
    return "This PC can't reach MongoDB. In MongoDB Atlas > Network Access, add this PC's current IP, then restart `pnpm dev`. Run `pnpm doctor` to check.";
  }
  return null;
}

/** The message for a failed username check: the generic text, plus the fix in development. */
export function usernameCheckError(error: unknown, isDev: boolean = process.env.NODE_ENV === "development"): string {
  if (!isDev) return GENERIC;
  return databaseHint(error) ?? `${GENERIC} (${error instanceof Error ? error.name : "unknown error"}; see the terminal running pnpm dev)`;
}
