import { vi } from "vitest";

// Shared mocks for unit-testing auth code without Next.js or a real Supabase project.
// Import this file first in a test, before the modules under test.

const hoisted = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  const supabase = {
    auth: {
      getClaims: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  };

  const admin = { from: vi.fn() };

  return { RedirectSignal, supabase, admin };
});

export const { RedirectSignal, supabase, admin } = hoisted;

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new hoisted.RedirectSignal(url);
  }),
}));

vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "example-publishable-key",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => hoisted.admin),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => hoisted.supabase),
}));

/** Mocks `from("stores").select().eq().maybeSingle()` to resolve with `result`. */
export function mockStoreQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  supabase.from.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

/** Mocks the service-role `from("stores").select().eq().maybeSingle()` username lookup. */
export function mockSlugLookup(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  admin.from.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

export function formData(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

/** Runs `fn` and returns the redirect URL it triggered (fails if it did not redirect). */
export async function redirectOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}
