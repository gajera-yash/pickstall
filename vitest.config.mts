import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // Placeholder values so modules that read the server env can load; unit tests never connect
          // anywhere (the database is mocked) and tests that need other values mock the env modules.
          env: {
            NEXT_PUBLIC_APP_URL: "https://pickstall.test",
            NEXT_PUBLIC_ROOT_DOMAIN: "pickstall.test",
            MONGODB_URI: "mongodb://unit-tests.invalid:27017",
            BETTER_AUTH_SECRET: "unit-test-secret-unit-test-secret-0000",
          },
        },
      },
      {
        // Real MongoDB, started in memory by the global setup: never the founder's database.
        resolve: {
          alias: { ...alias, "server-only": path.resolve(import.meta.dirname, "tests/integration/server-only-stub.ts") },
        },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
