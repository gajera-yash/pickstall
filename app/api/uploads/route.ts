import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { MEDIA_KINDS, MEDIA_MAX_BYTES, type MediaKind } from "@/lib/media/media";
import { saveImageUpload } from "@/lib/media/uploads";
import { UPLOAD_RATE_LIMIT } from "@/lib/config";
import { findStoreByOwner } from "@/lib/stores/queries";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

// Image upload for the signed-in creator (D-032): multipart `file` plus `kind` (avatar or cover).
// The store comes from the session; nothing about ownership is read from the request.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to upload.", 401);

  // Reject a huge body before reading it (the real check is on the bytes below).
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MEDIA_MAX_BYTES + 64 * 1024) return fail(`Use an image under ${MEDIA_MAX_BYTES / 1024 / 1024} MB.`, 413);

  try {
    const store = await findStoreByOwner(user.id);
    if (!store) return fail("Create your store first.", 403);

    const { max, windowMinutes } = UPLOAD_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("upload:owner", user.id), max, windowMinutes))) return fail("Slow down a little, then try again.", 429);

    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || typeof kind !== "string" || !(MEDIA_KINDS as readonly string[]).includes(kind)) return fail("Choose an image to upload.", 400);

    const result = await saveImageUpload(store.id, kind as MediaKind, new Uint8Array(await file.arrayBuffer()));
    if (!result.ok) return fail(result.error, result.status);
    return NextResponse.json({ url: result.data.url }, { status: 201, headers: NO_STORE });
  } catch (error) {
    logger.error("uploads.failed", { name: error instanceof Error ? error.name : undefined });
    return fail("Couldn't upload that image. Try again.", 500);
  }
}
