// Migration (D-071): fill in stores.ownerEmailKey (one store per inbox) and stores.stripeClaimKey (one
// real Stripe account per store) on stores created before Phase A.
//
// The founder runs this; it is never run automatically.
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/migrations/2026-11-15-store-identity-keys.mjs
//   Apply:                              node --env-file=.env.local scripts/migrations/2026-11-15-store-identity-keys.mjs --apply
//
// Safe to run more than once: it only fills fields that are missing and never changes or deletes a
// store. When two existing stores share an inbox or a Stripe account, the OLDEST store keeps the key
// and the others are listed (by store id only) for you to decide; nothing is taken away from them.
// It prints counts and store ids only: no emails, no account ids, no connection string.

import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";
// The test-mode shortcut account (D-034) may be shared by several stores, so it gets no claim.
const platformAccountId = process.env.STRIPE_PLATFORM_ACCOUNT_ID || null;

function out(line) {
  process.stdout.write(`${line}\n`);
}

/** Same rules as canonicalEmail in lib/auth/email-rules.ts. Keep the two in sync. */
function canonicalEmail(email) {
  if (typeof email !== "string") return null;
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  return local ? `${local}@${domain}` : null;
}

async function main() {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    out("MONGODB_URI is missing or not a mongodb:// URI. Pass --env-file=.env.local.");
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const stores = db.collection("stores");
    const users = db.collection("user");

    // Keys already taken by stores that have them (new stores since Phase A, or an earlier run).
    const takenEmail = new Set((await stores.distinct("ownerEmailKey", { ownerEmailKey: { $type: "string" } })).filter(Boolean));
    const takenClaim = new Set((await stores.distinct("stripeClaimKey", { stripeClaimKey: { $type: "string" } })).filter(Boolean));

    const old = await stores
      .find(
        { $or: [{ ownerEmailKey: { $exists: false } }, { stripeClaimKey: { $exists: false }, stripeAccountId: { $type: "string" } }] },
        { projection: { _id: 1, ownerId: 1, ownerEmailKey: 1, stripeAccountId: 1, stripeClaimKey: 1, createdAt: 1 } },
      )
      .sort({ createdAt: 1 })
      .toArray();

    const ownerIds = [...new Set(old.map((doc) => doc.ownerId))];
    const owners = await users.find({ _id: { $in: ownerIds } }, { projection: { _id: 1, email: 1 } }).toArray();
    const emailByOwner = new Map(owners.map((user) => [String(user._id), user.email]));

    const ops = [];
    const emailConflicts = [];
    const claimConflicts = [];
    let noEmail = 0;
    let emailKeys = 0;
    let claimKeys = 0;

    for (const doc of old) {
      const set = {};
      if (doc.ownerEmailKey === undefined) {
        const key = canonicalEmail(emailByOwner.get(String(doc.ownerId)));
        if (!key) noEmail++;
        else if (takenEmail.has(key)) emailConflicts.push(doc._id);
        else {
          takenEmail.add(key);
          set.ownerEmailKey = key;
          emailKeys++;
        }
      }
      if (doc.stripeClaimKey === undefined && typeof doc.stripeAccountId === "string" && doc.stripeAccountId !== platformAccountId) {
        if (takenClaim.has(doc.stripeAccountId)) claimConflicts.push(doc._id);
        else {
          takenClaim.add(doc.stripeAccountId);
          set.stripeClaimKey = doc.stripeAccountId;
          claimKeys++;
        }
      }
      if (Object.keys(set).length > 0) {
        const filter = { _id: doc._id, ...(set.ownerEmailKey ? { ownerEmailKey: { $exists: false } } : {}), ...(set.stripeClaimKey ? { stripeClaimKey: { $exists: false } } : {}) };
        ops.push({ updateOne: { filter, update: { $set: set } } });
      }
    }

    out(`Database: ${dbName}`);
    out(`Stores to look at: ${old.length}`);
    out(`  inbox keys to add: ${emailKeys}   (owner without an email: ${noEmail})`);
    out(`  Stripe claims to add: ${claimKeys}   (test shortcut account skipped: ${platformAccountId ? "yes" : "not set"})`);
    if (emailConflicts.length) out(`  Stores sharing an inbox with an older store (left as they are): ${emailConflicts.join(", ")}`);
    if (claimConflicts.length) out(`  Stores sharing a Stripe account with an older store (left as they are): ${claimConflicts.join(", ")}`);

    if (!apply) {
      out("Dry run: nothing was written. Run again with --apply to migrate.");
      return;
    }
    if (ops.length === 0) {
      out("Nothing to write.");
      return;
    }
    const result = await stores.bulkWrite(ops, { ordered: false });
    out(`Applied: ${result.modifiedCount} stores updated.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Migration failed: ${error?.name ?? "Error"}${error?.code ? ` (code ${error.code})` : ""}`);
  process.exitCode = 1;
});
