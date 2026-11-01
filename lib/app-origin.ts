import "server-only";

import { headers } from "next/headers";

import { extraDevHosts, resolveAppOrigin } from "@/lib/dev-hosts";
import { publicEnv } from "@/lib/env";

const isDev = process.env.NODE_ENV === "development";

/** Origin for redirects and absolute links from a request's headers (see `resolveAppOrigin`, D-041). */
export function appOriginFrom(list: Pick<Headers, "get">): string {
  return resolveAppOrigin({
    configured: publicEnv.NEXT_PUBLIC_APP_URL,
    isDev,
    host: list.get("x-forwarded-host") ?? list.get("host"),
    forwardedProto: list.get("x-forwarded-proto"),
    extra: extraDevHosts(process.env.DEV_ALLOWED_HOSTS),
  });
}

/** The same, for server actions and server components (reads the current request's headers). */
export async function appOrigin(): Promise<string> {
  return appOriginFrom(await headers());
}
