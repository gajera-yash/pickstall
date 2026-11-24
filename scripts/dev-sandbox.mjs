// `pnpm dev:sandbox`: the dev server on a throwaway in-memory MongoDB (port 3100), for trying the
// app or previewing UI without touching the real database. Data is gone when it stops. PayPal,
// Stripe, Resend and Google keys are emptied, so payments use the development mock and emails only log.
// The admin sign-in is a fresh throwaway one, printed in the log at start.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { MongoMemoryReplSet } from "mongodb-memory-server";

const PORT = Number(process.env.SANDBOX_PORT ?? process.env.PORT ?? 3100);

// A small WiredTiger cache: by default mongod claims about half the RAM.
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ args: ["--wiredTigerCacheSizeGB", "0.25"] }],
});

// For `node scripts/seed-sandbox.mjs <uri>` (demo buyer data). The in-memory database only.
process.stdout.write(`[sandbox] MongoDB: ${replSet.getUri()}
`);

// A throwaway admin sign-in for /admin/login, new on every start and never the real one (D-109):
// the real ADMIN_USERNAME / ADMIN_PASSWORD from the environment are replaced here.
const ADMIN_USERNAME = "sandbox-admin";
const ADMIN_PASSWORD = randomBytes(18).toString("base64url");
process.stdout.write(`[sandbox] Admin: /admin/login as ${ADMIN_USERNAME}, password ${ADMIN_PASSWORD}
`);

const next = path.join(import.meta.dirname, "..", "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "--port", String(PORT)], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB: "pickstall_sandbox",
    NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${PORT}`,
    BETTER_AUTH_SECRET: "sandbox-only-secret-0123456789abcdefghijkl",
    IP_HASH_SECRET: "sandbox-only-ip-hash-secret",
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    // Empty values win over .env.local (Next never overrides a variable that is already set).
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_CONNECT_WEBHOOK_SECRET: "",
    STRIPE_PLATFORM_WEBHOOK_SECRET: "",
    STRIPE_CONNECT_CLIENT_ID: "",
    STRIPE_PLATFORM_ACCOUNT_ID: "",
    PAYPAL_CLIENT_ID: "",
    PAYPAL_CLIENT_SECRET: "",
    PAYPAL_WEBHOOK_ID: "",
    PAYMENT_CREDENTIALS_KEY: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
  },
});

// On Windows `kill()` stops only the direct child; next dev's workers would keep the port.
const killTree = () => {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
};

const stop = async () => {
  killTree();
  await replSet.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => {
  await replSet.stop();
  process.exit(code ?? 0);
});
