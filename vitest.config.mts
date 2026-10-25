import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Load .env.local for DB tests (Node built-in, no dotenv dependency).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

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
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // The guard runs before any DB test file and aborts on a non-dev project.
          setupFiles: ["tests/db/guard.setup.ts"],
          // One hosted dev project: run files one at a time to avoid cross-test interference.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
