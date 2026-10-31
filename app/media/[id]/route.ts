import { connection } from "next/server";

import { isUuid } from "@/lib/media/media";
import { readImage } from "@/lib/media/uploads";

// Serves an uploaded image (D-032). Images are public because they appear on public pages. The
// type comes from our own record, never from a request; `nosniff` and a locked-down CSP keep a
// browser from treating the file as anything but an image.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const image = await readImage(id);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
