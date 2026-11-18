"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCreator } from "@/lib/auth/guards";
import { updateCoachingDetails } from "@/lib/coaching/queries";
import { coachingDetailsInputFor } from "@/lib/coaching/schemas";
import { PRODUCT_RATE_LIMIT } from "@/lib/config";
import { logger } from "@/lib/logger";
import { createDraftProduct } from "@/lib/products/queries";
import { productIdInput } from "@/lib/products/schemas";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Coaching editor actions (D-081). The call is always found with the session owner's store id;
// every field is checked again on the server, prices in the store's currency.

export type SaveCoachingState = Result<{ savedAt: number }> | null;

const MAX_PAYLOAD_CHARS = 40_000;
const NOT_FOUND = "We couldn't find that coaching call. Reload the page and try again.";

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

async function allowed(ownerId: string): Promise<boolean> {
  const { max, windowMinutes } = PRODUCT_RATE_LIMIT;
  return takeRateLimit(rateLimitKey("product-write:owner", ownerId), max, windowMinutes);
}

/** Creates a draft coaching call (30 minutes, weekdays 9 to 5, free until priced) and opens its editor. */
export async function createCoachingAndEdit(): Promise<void> {
  const { user, store } = await requireCreator("/dashboard/products/new");
  if (!(await allowed(user.id))) redirect("/dashboard/products?error=slow");
  const result = await createDraftProduct(store.id, { buttonText: "Book a call", type: "coaching" }).catch((error: unknown) => {
    logger.error("coaching.create_failed", { name: errorName(error) });
    return "error" as const;
  });
  if (typeof result === "string") redirect(`/dashboard/products?error=${result}`);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/products/${result.id}`);
}

/** Saves the coaching editor (details, availability, price). */
export async function saveCoachingDetails(productId: string, _prev: SaveCoachingState, formData: FormData): Promise<SaveCoachingState> {
  const { user, store } = await requireCreator(`/dashboard/products/${productId}`);
  if (!productIdInput.safeParse(productId).success) return err(NOT_FOUND);

  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > MAX_PAYLOAD_CHARS) return err("Check the form and try again.");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err("Check the form and try again.");
  }

  const parsed = coachingDetailsInputFor(store.currency).safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return err(issue?.message ?? "Check the form and try again.", typeof field === "string" ? field : undefined);
  }
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");

  try {
    if ((await updateCoachingDetails(store.id, productId, parsed.data)) === "not_found") return err(NOT_FOUND);
  } catch (error) {
    logger.error("coaching.save_failed", { name: errorName(error) });
    return err("Couldn't save your coaching call. Check your connection and try again.");
  }

  revalidatePath("/dashboard", "layout");
  return ok({ savedAt: Date.now() });
}
