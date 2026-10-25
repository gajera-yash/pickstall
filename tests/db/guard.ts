import { existsSync, readFileSync } from "node:fs";

// Safety guard for database tests (docs/DECISIONS.md D-001).
// DB tests create and delete users and rows, so they must only ever run against the
// founder's hosted DEV project. Every check below must pass or no DB test runs.

export const LINKED_PROJECT_REF_FILE = "supabase/.temp/project-ref";
const PROJECT_REF_PATTERN = /^[a-z0-9]{15,40}$/;

type Env = Record<string, string | undefined>;

type GuardDeps = {
  readLinkedRef?: () => string | null;
};

function readLinkedRefFromDisk(): string | null {
  if (!existsSync(LINKED_PROJECT_REF_FILE)) return null;
  return readFileSync(LINKED_PROJECT_REF_FILE, "utf8").trim();
}

/** Throws unless the environment clearly points at the dev project. Returns the project ref. */
export function assertDevProject(env: Env, deps: GuardDeps = {}): string {
  const fail = (reason: string): never => {
    throw new Error(`DB tests refused to run: ${reason}. See docs/DECISIONS.md (D-001).`);
  };

  if (env.DB_TESTS_ALLOW !== "dev-only") fail("DB_TESTS_ALLOW must be set to dev-only");
  if (env.NODE_ENV === "production") fail("NODE_ENV is production");
  if (env.VERCEL_ENV) fail("running inside a Vercel environment");
  if (env.CI) fail("running in CI");

  const ref = env.SUPABASE_DEV_PROJECT_REF ?? "";
  if (!PROJECT_REF_PATTERN.test(ref)) fail("SUPABASE_DEV_PROJECT_REF is missing or malformed");

  let url: URL;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return fail("NEXT_PUBLIC_SUPABASE_URL is missing or not a URL");
  }
  if (url.protocol !== "https:" || url.hostname !== `${ref}.supabase.co` || url.port !== "") {
    fail("NEXT_PUBLIC_SUPABASE_URL does not match SUPABASE_DEV_PROJECT_REF");
  }
  if (url.pathname !== "/" || url.search !== "" || url.username !== "" || url.password !== "") {
    fail("NEXT_PUBLIC_SUPABASE_URL must be the bare project URL");
  }

  const linkedRef = (deps.readLinkedRef ?? readLinkedRefFromDisk)();
  if (linkedRef !== null && linkedRef !== ref) {
    fail("the Supabase CLI is linked to a different project than SUPABASE_DEV_PROJECT_REF");
  }

  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is missing");

  return ref;
}
