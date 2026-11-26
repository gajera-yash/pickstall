import { serverEnv } from "@/lib/env.server";

// The IndexNow key file (D-134). Bing, Yandex and other IndexNow engines fetch it to check that a
// "please recrawl these URLs" ping really comes from this site. The key is not a secret; without
// INDEXNOW_KEY this answers 404.

export function GET() {
  const key = serverEnv.INDEXNOW_KEY;
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
