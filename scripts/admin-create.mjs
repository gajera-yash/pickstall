// Creates a platform admin account in MongoDB, or resets its password (D-108).
//
// The founder runs this; it is never run automatically.
//   Create:          node --env-file=.env.local scripts/admin-create.mjs
//   Reset password:  node --env-file=.env.local scripts/admin-create.mjs --reset
//
// It asks for the username and the password (the password is not shown and is stored only as a
// scrypt hash, the format lib/admin/session.ts verifies). A reset also signs out that admin's
// sessions. It prints no secrets.

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

import { MongoClient } from "mongodb";

const reset = process.argv.includes("--reset");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";
const COST = { N: 16384, r: 8, p: 1 };

function out(line) {
  process.stdout.write(`${line}\n`);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64, { ...COST, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

/** Reads a line without echoing it (falls back to plain input when not a terminal). */
function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) {
      const rl = createInterface({ input: stdin });
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\u0003") {
        stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(1);
      }
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
      else value += char;
    };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    out("MONGODB_URI is missing. Run it with --env-file=.env.local.");
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const username = (await rl.question("Admin username: ")).trim();
  rl.close();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    out("Use 3-64 letters, numbers, dots, dashes or underscores. Nothing was saved.");
    process.exitCode = 1;
    return;
  }
  const password = await askHidden("Password (at least 12 characters): ");
  if (password.length < 12) {
    out("Use at least 12 characters. Nothing was saved.");
    process.exitCode = 1;
    return;
  }
  const again = await askHidden("Password again: ");
  if (again !== password) {
    out("The passwords are different. Nothing was saved.");
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("adminUsers");
    await users.createIndex({ usernameKey: 1 }, { unique: true, name: "admin_users_username_unique" });
    const usernameKey = username.toLowerCase();
    const existing = await users.findOne({ usernameKey }, { projection: { _id: 1 } });
    const now = new Date();

    if (reset) {
      if (!existing) {
        out("No admin with that username. Run without --reset to create one.");
        process.exitCode = 1;
        return;
      }
      await users.updateOne({ _id: existing._id }, { $set: { passwordHash: hashPassword(password), passwordChangedAt: now, updatedAt: now } });
      const ended = await db.collection("adminSessions").deleteMany({ adminId: existing._id });
      out(`Password reset for ${username}. ${ended.deletedCount} session(s) signed out.`);
      return;
    }
    if (existing) {
      out("That admin already exists. Use --reset to set a new password.");
      process.exitCode = 1;
      return;
    }
    await users.insertOne({ _id: randomUUID(), username, usernameKey, passwordHash: hashPassword(password), createdAt: now, updatedAt: now, passwordChangedAt: now, lastLoginAt: null });
    out(`Admin ${username} created. Sign in at /admin/login.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Failed: ${error instanceof Error ? error.name : "error"}`);
  process.exitCode = 1;
});
