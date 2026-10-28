import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

// Better Auth endpoints, mainly the Google OAuth return URL (/api/auth/callback/google).
export const { GET, POST } = toNextJsHandler(auth);
