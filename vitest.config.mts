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
