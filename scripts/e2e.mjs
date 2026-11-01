// Runs the Playwright smoke test against a throwaway in-memory MongoDB (R9). Never touches the
// founder's database: the dev server started by playwright.config.ts gets this server's URI, and the
// spec seeds its own data (tests/e2e/smoke.spec.ts).
// Usage: pnpm test:e2e [playwright args]
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { MongoMemoryReplSet } from "mongodb-memory-server";

// A small WiredTiger cache: by default mongod claims about half the RAM, which starves the dev server.
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ args: ["--wiredTigerCacheSizeGB", "0.25"] }],
});
for (const server of replSet.servers) {
  const recent = [];
  server.instanceInfo?.instance.on("instanceSTDOUT", (line) => {
    recent.push(String(line));
    if (recent.length > 20) recent.shift();
  });
  server.instanceInfo?.instance.on("instanceClosed", (code) => {
    if (code) process.stderr.write(`[e2e] mongod exited with code ${code}. Last log lines:\n${recent.join("")}\n`);
  });
}

const uploadDir = await mkdtemp(path.join(tmpdir(), "pickstall-e2e-"));
let code = 1;
try {
  code = await new Promise((resolve) => {
    // Node runs Playwright's CLI directly: no shell, so arguments like --grep "two words" stay intact.
    const cli = path.join(import.meta.dirname, "..", "node_modules", "@playwright", "test", "cli.js");
    const child = spawn(process.execPath, [cli, "test", ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, MONGODB_URI: replSet.getUri(), MONGODB_DB: "pickstall_e2e", E2E_UPLOAD_DIR: uploadDir },
    });
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
  });
} finally {
  await replSet.stop();
  await rm(uploadDir, { recursive: true, force: true });
}
process.exit(code);
