import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { PRODUCT_FILE_MAX_BYTES, PRODUCT_FILE_UPLOAD_RATE_LIMIT } from "@/lib/config";
import { removeProductFile, saveProductFile } from "@/lib/files/product-files";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

/** The creator's own store for this request, or a response that says why not. */
async function ownerStore(): Promise<{ id: string; ownerId: string } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to upload.", 401);
  const store = await findStoreByOwner(user.id);
  if (!store) return fail("Create your store first.", 403);
  return { id: store.id, ownerId: user.id };
}

// Product file upload (D-050): the raw file is the body, its name is in `X-File-Name`. The store
// comes from the session and the product must belong to it; nothing about ownership is read from
// the request. The body is streamed to private storage, never held in memory.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail("We couldn't find that product.", 404);

  // Refuse a huge body before reading it; the real limit is enforced while streaming.
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > PRODUCT_FILE_MAX_BYTES) return fail(`Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`, 413);

  const rawName = decodeURIComponent(request.headers.get("x-file-name") ?? "").slice(0, 300);
  if (!rawName || !request.body) return fail("Choose a file to upload.", 400);

  try {
    const owner = await ownerStore();
    if (owner instanceof NextResponse) return owner;
    const { max, windowMinutes } = PRODUCT_FILE_UPLOAD_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("product-file:owner", owner.ownerId), max, windowMinutes))) return fail("Slow down a little, then try again.", 429);

    const result = await saveProductFile(owner.id, id, rawName, request.body);
    if (!result.ok) return fail(result.error, result.status);
    return NextResponse.json({ file: result.data }, { status: 201, headers: NO_STORE });
  } catch (error) {
    logger.error("product_files.upload_failed", { name: error instanceof Error ? error.name : undefined });
    return fail("Couldn't upload that file. Check your connection and try again.", 500);
  }
}

/** Removes the product's file; the product goes back to link delivery. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail("We couldn't find that product.", 404);
  try {
    const owner = await ownerStore();
    if (owner instanceof NextResponse) return owner;
    if (!(await removeProductFile(owner.id, id))) return fail("We couldn't find that product.", 404);
    return NextResponse.json({ removed: true }, { headers: NO_STORE });
  } catch (error) {
    logger.error("product_files.remove_failed", { name: error instanceof Error ? error.name : undefined });
    return fail("Couldn't remove that file. Try again.", 500);
  }
}
