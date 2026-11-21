"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { GumroadError, fetchGumroadCandidates } from "@/lib/imports/gumroad";
import { importDraftProducts, type ImportResult } from "@/lib/imports/queries";
import { IMPORT_PRODUCTS_MAX, csvImportInput, fromCsvRow, type ImportCandidate } from "@/lib/imports/rules";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Products > Import (PRD 9): from Gumroad with the creator's own access token, or from a CSV (Stan
// has no export, so creators list their products in a sheet). Everything lands as drafts in the
// session owner's store; nothing from the browser is trusted (Gumroad is fetched again on import,
// CSV cells are cleaned and checked again here).

const PATH = "/dashboard/products/import";
const token = z.string().trim().regex(/^[A-Za-z0-9_-]{20,200}$/, { error: "Paste the access token from your Gumroad application page." });

async function allowed(ownerId: string): Promise<boolean> {
  return takeRateLimit(rateLimitKey("product-import:owner", ownerId), 20, 15);
}

const GUMROAD_ERRORS: Record<GumroadError["kind"], string> = {
  bad_token: "Gumroad didn't accept that token. Generate a new one on your Gumroad application page and paste it again.",
  unavailable: "Couldn't reach Gumroad. Try again in a minute.",
  bad_response: "Gumroad sent something we couldn't read. Try again, or use the CSV import.",
};

export type GumroadPreview = { items: (Omit<ImportCandidate, "coverSourceUrl"> & { hasCover: boolean })[] };

/** Lists the creator's Gumroad products for the preview. The token is not stored. */
export async function previewGumroadAction(rawToken: string): Promise<Result<GumroadPreview>> {
  const { user, store } = await requireUnlockedCreator(PATH);
  const parsed = token.safeParse(rawToken);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the token.", "token");
  if (!(await allowed(user.id))) return err("Too many tries. Wait a few minutes, then try again.");
  try {
    const items = await fetchGumroadCandidates(parsed.data, store.currency);
    return ok({ items: items.slice(0, IMPORT_PRODUCTS_MAX).map(({ coverSourceUrl, ...item }) => ({ ...item, hasCover: coverSourceUrl !== null })) });
  } catch (error) {
    if (error instanceof GumroadError) return err(GUMROAD_ERRORS[error.kind], error.kind === "bad_token" ? "token" : undefined);
    logger.error("imports.gumroad_preview_failed", { name: error instanceof Error ? error.name : undefined });
    return err(GUMROAD_ERRORS.unavailable);
  }
}

/** Imports the chosen Gumroad products as drafts. Gumroad is asked again; ids from the browser only pick. */
export async function importGumroadAction(rawToken: string, ids: string[]): Promise<Result<ImportResult>> {
  const { user, store } = await requireUnlockedCreator(PATH);
  const parsed = token.safeParse(rawToken);
  const picked = z.array(z.string().min(1).max(100)).min(1).max(IMPORT_PRODUCTS_MAX).safeParse(ids);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the token.", "token");
  if (!picked.success) return err("Choose at least one product to import.");
  if (!(await allowed(user.id))) return err("Too many tries. Wait a few minutes, then try again.");
  try {
    const wanted = new Set(picked.data);
    const items = (await fetchGumroadCandidates(parsed.data, store.currency)).filter((item) => wanted.has(item.externalId));
    const result = await importDraftProducts(store.id, items);
    revalidatePath("/dashboard", "layout");
    return ok(result);
  } catch (error) {
    if (error instanceof GumroadError) return err(GUMROAD_ERRORS[error.kind]);
    logger.error("imports.gumroad_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't import your products. Try again.");
  }
}

/** Imports CSV rows (title, price, description) as drafts, priced in the store's currency. */
export async function importCsvAction(input: unknown): Promise<Result<ImportResult & { invalid: number }>> {
  const { user, store } = await requireUnlockedCreator(PATH);
  const parsed = csvImportInput.safeParse(input);
  if (!parsed.success) return err(`Import 1 to ${IMPORT_PRODUCTS_MAX} products at a time.`);
  if (!(await allowed(user.id))) return err("Too many tries. Wait a few minutes, then try again.");
  const candidates: ImportCandidate[] = [];
  let invalid = 0;
  for (const row of parsed.data.rows) {
    const item = fromCsvRow([row.title, row.price, row.description], { title: 0, price: 1, description: 2 }, store.currency);
    if ("error" in item) invalid += 1;
    else candidates.push(item);
  }
  try {
    const result = await importDraftProducts(store.id, candidates);
    revalidatePath("/dashboard", "layout");
    return ok({ ...result, invalid });
  } catch (error) {
    logger.error("imports.csv_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't import your products. Try again.");
  }
}
