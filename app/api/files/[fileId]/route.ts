import { NextResponse, type NextRequest } from "next/server";

import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import { failJson, resultResponse, uploadOwner } from "@/lib/files/upload-routes";
import { writePendingUpload } from "@/lib/files/uploads";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";

// Step 2 of an upload when files are kept on this server's disk (development, or an own server;
// D-093). On the live site the browser uploads to a signed R2 link instead and never calls this.
// Only a pending upload of the signed-in creator's own store is accepted.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!isUuid(fileId)) return failJson("We couldn't find that upload. Try again.", 404);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > PRODUCT_FILE_MAX_BYTES) return failJson(`Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`, 413);
  if (!request.body) return failJson("Choose a file to upload.", 400);
  try {
    const owner = await uploadOwner();
    if (owner instanceof NextResponse) return owner;
    return resultResponse(await writePendingUpload(owner.storeId, fileId, request.body), "written");
  } catch (error) {
    logger.error("files.upload_write_failed", { name: error instanceof Error ? error.name : undefined });
    return failJson("Couldn't upload that file. Check your connection and try again.", 500);
  }
}
