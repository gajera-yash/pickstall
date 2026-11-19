import { NextResponse, type NextRequest } from "next/server";

import { failJson, resultResponse, uploadOwner } from "@/lib/files/upload-routes";
import { finishFileUpload } from "@/lib/files/uploads";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";

// Step 3 of an upload (D-093): the server checks the stored bytes (size, and the type against the
// name), then marks the file ready and attaches it to the product or lesson.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!isUuid(fileId)) return failJson("We couldn't find that upload. Try again.", 404);
  try {
    const owner = await uploadOwner();
    if (owner instanceof NextResponse) return owner;
    return resultResponse(await finishFileUpload(owner.storeId, fileId), "file");
  } catch (error) {
    logger.error("files.upload_finish_failed", { name: error instanceof Error ? error.name : undefined });
    return failJson("Couldn't check that file. Try again.", 500);
  }
}
