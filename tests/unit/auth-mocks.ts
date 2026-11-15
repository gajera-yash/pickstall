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
    signInEmail: vi.fn(),
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
    setStoreStripeConnection: vi.fn(),
    countOtherStoresWithAccount: vi.fn(async () => 0),
  };
  const profiles = { getProfile: vi.fn(), saveProfile: vi.fn() };
  const slugs = { isSlugTaken: vi.fn(), findTakenSlugs: vi.fn() };
  const testAccount = { testSellerAccountId: vi.fn() };
  const currencyLock = { isCurrencyLocked: vi.fn(async () => false) };
  const library = { hasPurchases: vi.fn() };
  // Stripe Connect (D-053): the OAuth helpers and our state flow, so no Stripe or database is needed.
  const stripeConnect = {
    connectAvailable: vi.fn(() => true),
    connectAuthorizeUrl: vi.fn(() => "https://connect.stripe.com/oauth/authorize?state=abc"),
  };
  const connectFlow = {
    CONNECT_RETURN_PATHS: { settings: "/dashboard/settings/payments", setup: "/dashboard/setup" },
    connectRedirectUri: () => "http://localhost:3000/api/connect/stripe/callback",
    createConnectState: vi.fn(async () => "state-abc"),
    releaseAccount: vi.fn(async () => undefined),
  };
  const rateLimit = { takeRateLimit: vi.fn(), releaseRateLimit: vi.fn() };
  // Phase A (D-071): the new-store gate, the browser id and the "email has an account" check.
  const newStore = { checkNewStore: vi.fn(async () => ({ ok: true })), recordNewStore: vi.fn(async () => undefined) };
  const accounts = { emailHasAccount: vi.fn(async () => false) };

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
    testAccount,
    currencyLock,
    library,
    stripeConnect,
    connectFlow,
    newStore,
    accounts,
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
  testAccount,
  currencyLock,
  library,
  stripeConnect,
  connectFlow,
  newStore,
  accounts,
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
vi.mock("@/lib/payments/test-account", () => hoisted.testAccount);
vi.mock("@/lib/stores/currency-lock", () => hoisted.currencyLock);
vi.mock("@/lib/library/queries", () => hoisted.library);
vi.mock("@/lib/payments/connect", () => hoisted.stripeConnect);
vi.mock("@/lib/stores/stripe-connect", () => hoisted.connectFlow);
vi.mock("@/lib/stores/new-store-guard", () => hoisted.newStore);
vi.mock("@/lib/auth/accounts", () => hoisted.accounts);
vi.mock("@/lib/auth/device", () => ({ DEVICE_COOKIE: "ps_device", deviceId: vi.fn(async () => "test-device-id") }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitKey: (scope: string, value: string) => `${scope}:${value}`,
  takeRateLimit: hoisted.rateLimit.takeRateLimit,
  releaseRateLimit: hoisted.rateLimit.releaseRateLimit,
}));

export const userId = "11111111-1111-4111-8111-111111111111";

/** A store in its free trial (D-072): may sell and publish. */
export const OPEN_ACCESS = { state: "trial", endsAt: null, daysLeft: null, plan: null, cancelsAtPeriodEnd: false } as const;
/** A store whose trial has ended: paused. */
export const PAUSED_ACCESS = { state: "paused", endsAt: new Date("2026-01-01T00:00:00Z"), daysLeft: 0, plan: null, cancelsAtPeriodEnd: false } as const;

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
