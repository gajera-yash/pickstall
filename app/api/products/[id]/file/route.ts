import { NextResponse, type NextRequest } from "next/server";

import { removeProductFile } from "@/lib/files/product-files";
import { NO_STORE, failJson, startUploadResponse, uploadOwner } from "@/lib/files/upload-routes";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";

const fail = failJson;

// Step 1 of a product file upload (D-093): `{ name, size }` in, a pending upload and where the
// browser sends the bytes out (lib/files/uploads.ts). The store comes from the session and the
// product must belong to it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail("We couldn't find that product.", 404);
  return startUploadResponse(request, { kind: "product", productId: id });
}

/** Removes the product's file; the product goes back to link delivery. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail("We couldn't find that product.", 404);
  try {
    const owner = await uploadOwner();
    if (owner instanceof NextResponse) return owner;
    if (!(await removeProductFile(owner.storeId, id))) return fail("We couldn't find that product.", 404);
    return NextResponse.json({ removed: true }, { headers: NO_STORE });
  } catch (error) {
    logger.error("product_files.remove_failed", { name: error instanceof Error ? error.name : undefined });
    return fail("Couldn't remove that file. Try again.", 500);
  }
}
