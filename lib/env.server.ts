import "server-only";

import { parseEnv, serverEnvSchema } from "@/lib/env-schema";

/** Server-only env, including secrets. Importing this from a client component fails the build. */
export const serverEnv = parseEnv(serverEnvSchema, process.env);
