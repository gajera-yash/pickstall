import { unstable_isUnrecognizedActionError } from "next/navigation";

import { err, type Result } from "@/lib/result";

// Calls a server action from the browser and turns two failures into a message instead of the error
// page: a page opened before a new deployment (Next.js changes action ids on every build, and the
// server answers 409 "Server Action unavailable"), and a dropped connection. Anything else is rethrown.

export const APP_UPDATED_MESSAGE = "Pickstall was just updated. Reload this page, then try again.";
export const OFFLINE_MESSAGE = "Couldn't reach Pickstall. Check your connection and try again.";

export async function callAction<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    if (unstable_isUnrecognizedActionError(error)) return err(APP_UPDATED_MESSAGE);
    if (error instanceof TypeError) return err(OFFLINE_MESSAGE);
    throw error;
  }
}
