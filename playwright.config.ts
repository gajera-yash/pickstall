import { defineConfig, devices } from "@playwright/test";

// E2E smoke (R9). Run with `pnpm test:e2e`: scripts/e2e.mjs starts a throwaway in-memory MongoDB,
// seeds it and then runs Playwright, which starts the dev server pointed at that database. The
// dev server gets empty Stripe, Resend and Google keys, so nothing leaves this machine.

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

if (!process.env.MONGODB_URI?.startsWith("mongodb://127.0.0.1")) {
  throw new Error("Run the e2e tests with `pnpm test:e2e` (it starts the in-memory database).");
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Generous: the first visit to each route compiles it, which takes minutes on a slow disk.
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `${baseURL}/login`,
    // The first compile on a slow disk can take minutes.
    timeout: 600_000,
    // E2E_REUSE=1 reuses a dev server already started on this port against the same in-memory database.
    reuseExistingServer: Boolean(process.env.E2E_REUSE),
    stdout: process.env.E2E_DEBUG ? "pipe" : "ignore",
    stderr: "pipe",
    env: {
      MONGODB_URI: process.env.MONGODB_URI,
      MONGODB_DB: process.env.MONGODB_DB ?? "pickstall_e2e",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghijklmnop",
      IP_HASH_SECRET: "e2e-only-ip-hash-secret",
      UPLOAD_DIR: process.env.E2E_UPLOAD_DIR ?? "",
      // Empty values win over .env.local (Next never overrides a variable that is already set).
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_CONNECT_WEBHOOK_SECRET: "",
      STRIPE_PLATFORM_ACCOUNT_ID: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    },
  },
});
