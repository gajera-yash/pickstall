import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/guards";
import { PRODUCT_FILE_UPLOAD_RATE_LIMIT } from "@/lib/config";
import { startFileUpload, type UploadResult, type UploadTarget } from "@/lib/files/uploads";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";

// Shared pieces of the file upload route handlers (D-093), so each route stays thin.

export const NO_STORE = { "Cache-Control": "no-store" };
export const failJson = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** The signed-in creator's store id, or a response that says why not. Never read from the request. */
export async function uploadOwner(): Promise<{ storeId: string; userId: string } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return failJson("Sign in to upload.", 401);
  const store = await findStoreByOwner(user.id);
  if (!store) return failJson("Create your store first.", 403);
  return { storeId: store.id, userId: user.id };
}

const startBody = z.object({ name: z.string().trim().min(1).max(300), size: z.number().int().positive() });

/** Step 1 of an upload for a route: validates the body, rate limits, starts the upload. */
export async function startUploadResponse(request: Request, target: UploadTarget): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failJson("Choose a file to upload.", 400);
  }
  const parsed = startBody.safeParse(json);
  if (!parsed.success) return failJson("Choose a file to upload.", 400);

  try {
    const owner = await uploadOwner();
    if (owner instanceof NextResponse) return owner;
    const { max, windowMinutes } = PRODUCT_FILE_UPLOAD_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("product-file:owner", owner.userId), max, windowMinutes))) return failJson("Slow down a little, then try again.", 429);
    return resultResponse(await startFileUpload(owner.storeId, target, parsed.data.name, parsed.data.size), "upload", 201);
  } catch (error) {
    logger.error("files.upload_start_failed", { name: error instanceof Error ? error.name : undefined });
    return failJson("Couldn't start the upload. Try again.", 500);
  }
}

/** A lib result as JSON: `{ [key]: data }` on success, `{ error }` with its status otherwise. */
export function resultResponse<T>(result: UploadResult<T>, key: string, status = 200): NextResponse {
  if (!result.ok) return failJson(result.error, result.status);
  return NextResponse.json({ [key]: result.data }, { status, headers: NO_STORE });
}
