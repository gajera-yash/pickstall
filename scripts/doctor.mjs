// `pnpm doctor`: checks that this machine can run Pickstall (D-041). Run it on any new PC before
// `pnpm dev`. It reads .env.local, never prints secret values, and only pings MongoDB (read-only).
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";

import { MongoClient } from "mongodb";

const root = path.join(import.meta.dirname, "..");
const print = (line = "") => process.stdout.write(`${line}\n`);
const ok = (text) => print(`  OK    ${text}`);
const bad = (text, fix) => {
  failures++;
  print(`  FAIL  ${text}`);
  if (fix) print(`        Fix: ${fix}`);
};
const warn = (text, fix) => {
  print(`  WARN  ${text}`);
  if (fix) print(`        Tip: ${fix}`);
};
let failures = 0;

print("Pickstall doctor\n");

// 1. Node.js: Next.js 16 needs 20.9 or newer.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 20 || (major === 20 && minor >= 9)) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node} is too old`, "install Node.js 20.9 or newer (22 LTS or 24 recommended) from nodejs.org");

// 2. Dependencies installed.
if (existsSync(path.join(root, "node_modules", "next"))) ok("Dependencies installed");
else bad("node_modules is missing", "run `pnpm install` in the project folder");

// 3. .env.local present and complete. It is never in git, so a new PC needs its own copy.
const envFile = path.join(root, ".env.local");
if (!existsSync(envFile)) {
  bad(".env.local is missing", "copy .env.example to .env.local and fill in the values (copy them safely from your main PC, never through git)");
} else {
  process.loadEnvFile(envFile);
  ok(".env.local found");
}

const required = {
  NEXT_PUBLIC_APP_URL: (v) => /^https?:\/\/[^\s/]+/.test(v) || "must be a URL like http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: (v) => v.length > 0 || "must be set, for example localhost:3000",
  MONGODB_URI: (v) => /^mongodb(\+srv)?:\/\//.test(v) || "must start with mongodb:// or mongodb+srv://",
  BETTER_AUTH_SECRET: (v) => v.length >= 32 || "must be at least 32 characters",
};
for (const [name, check] of Object.entries(required)) {
  const value = process.env[name] ?? "";
  if (!value) {
    bad(`${name} is not set`, `add ${name}=... to .env.local`);
    continue;
  }
  const result = check(value);
  if (result === true) ok(`${name} is set`);
  else bad(`${name} ${result}`);
}

// 4. The address other devices can use, and the note about NEXT_PUBLIC_APP_URL.
const lan = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net.address);
if (lan.length) print(`\n  From another device on this network, open: ${lan.map((ip) => `http://${ip}:3000`).join("  or  ")}`);
print("  (Development follows the address you open; links in emails still use NEXT_PUBLIC_APP_URL.)\n");

// 5. MongoDB reachable from THIS machine.
const uri = process.env.MONGODB_URI;
if (uri && /^mongodb(\+srv)?:\/\//.test(uri)) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  try {
    await client.db(process.env.MONGODB_DB || "pickstall").command({ ping: 1 });
    ok("MongoDB answers from this PC");
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/querySrv|ENOTFOUND|ECONNREFUSED.*_mongodb\._tcp|EREFUSED/i.test(message)) {
      bad(
        "MongoDB address could not be found (DNS lookup failed on this network)",
        "set this PC's DNS to 8.8.8.8 / 1.1.1.1, or in Atlas use Connect > Drivers and choose the standard (non-SRV, mongodb://) connection string for MONGODB_URI",
      );
    } else if (/auth|Authentication failed|bad auth/i.test(message)) {
      bad("MongoDB rejected the username or password", "copy MONGODB_URI again from your main PC (the password may have been rotated)");
    } else if (/timed out|Server selection|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message)) {
      bad(
        "MongoDB did not answer from this PC",
        "in MongoDB Atlas > Network Access, add this PC's public IP (or your network), then try again; also check a firewall or VPN",
      );
    } else {
      bad(`MongoDB connection failed (${error?.name ?? "Error"})`, "check MONGODB_URI and your internet connection");
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

// 6. Optional services.
if (!process.env.RESEND_API_KEY) warn("RESEND_API_KEY not set", "fine for development: sign-in codes are printed in the terminal");
if (!process.env.IP_HASH_SECRET) warn("IP_HASH_SECRET not set", "per-IP rate limits are off until it is set");

print(failures ? `\n${failures} problem(s) found. Fix them, then run \`pnpm doctor\` again.` : "\nAll good. Start with `pnpm dev`.");
process.exit(failures ? 1 : 0);
