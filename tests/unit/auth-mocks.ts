import { vi } from "vitest";

// Shared mocks for unit-testing auth code without Next.js, Better Auth or a real MongoDB.
// Import this file first in a test, before the modules under test.

const hoisted = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super(`redirect:${url}`);
    }
  }

  /** Stands in for Better Auth's APIError (status code plus an internal message). */
  class FakeAPIError extends Error {
    constructor(
      public readonly statusCode: number,
      message = "internal detail",
    ) {
      super(message);
    }
  }

  const authApi = {
    getSession: vi.fn(),
    sendVerificationOTP: vi.fn(),
    signInEmailOTP: vi.fn(),
    signInSocial: vi.fn(),
    signOut: vi.fn(),
  };

  // In-memory cookie jar for next/headers cookies().
  const cookieJar = new Map<string, string>();
  const cookieStore = {
    get: vi.fn((name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) as string } : undefined)),
    set: vi.fn((name: string, value: string) => void cookieJar.set(name, value)),
    delete: vi.fn((name: string) => void cookieJar.delete(name)),
  };

  const intents = { saveSignupIntent: vi.fn(), takeSignupIntent: vi.fn() };
  const draftStore = { createDraftStore: vi.fn() };
  const storeQueries = {
    findStoreByOwner: vi.fn(),
    updateStoreProfile: vi.fn(),
    updateStorePageDesign: vi.fn(),
    changeStoreSlug: vi.fn(),
    setStorePublished: vi.fn(),
  };
  const profiles = { getProfile: vi.fn(), saveProfile: vi.fn() };
  const slugs = { isSlugTaken: vi.fn(), findTakenSlugs: vi.fn() };
  const rateLimit = { takeRateLimit: vi.fn(), releaseRateLimit: vi.fn() };

  return {
    RedirectSignal,
    FakeAPIError,
    authApi,
    cookieJar,
    cookieStore,
    intents,
    draftStore,
    storeQueries,
    profiles,
    slugs,
    rateLimit,
  };
});

export const {
  RedirectSignal,
  FakeAPIError,
  authApi,
  cookieJar,
  cookieStore,
  intents,
  draftStore,
  storeQueries,
  profiles,
  slugs,
  rateLimit,
} = hoisted;

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new hoisted.RedirectSignal(url);
  }),
  unstable_rethrow: vi.fn((error: unknown) => {
    if (error instanceof hoisted.RedirectSignal) throw error;
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => hoisted.cookieStore),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/request-ip", () => ({
  getClientIpHash: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: { api: hoisted.authApi } }));

vi.mock("better-auth/api", () => ({
  isAPIError: (error: unknown) => error instanceof hoisted.FakeAPIError,
}));

vi.mock("@/lib/auth/signup-intents", () => ({
  TOO_MANY_SIGNUPS: "Too many sign-up attempts. Wait 15 minutes, then try again.",
  saveSignupIntent: hoisted.intents.saveSignupIntent,
  takeSignupIntent: hoisted.intents.takeSignupIntent,
}));

vi.mock("@/lib/stores/create-draft-store", () => ({
  createDraftStore: hoisted.draftStore.createDraftStore,
}));

vi.mock("@/lib/stores/queries", () => hoisted.storeQueries);
vi.mock("@/lib/auth/profiles", () => hoisted.profiles);
vi.mock("@/lib/stores/slug-availability", () => hoisted.slugs);

vi.mock("@/lib/rate-limit", () => ({
  rateLimitKey: (scope: string, value: string) => `${scope}:${value}`,
  takeRateLimit: hoisted.rateLimit.takeRateLimit,
  releaseRateLimit: hoisted.rateLimit.releaseRateLimit,
}));

export const userId = "11111111-1111-4111-8111-111111111111";

/** Makes getSession return a signed-in user (or nobody, with `null`). */
export function mockSession(user: { id: string; email: string } | null) {
  authApi.getSession.mockResolvedValue(user ? { user, session: { id: "session-1" } } : null);
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
