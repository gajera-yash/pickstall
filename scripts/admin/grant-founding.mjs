// Founding creators (D-072): make a store free for FOUNDING_MONTHS (default 6) from today.
//
// The founder runs this; it is never run automatically.
//   Check (writes nothing):  node --env-file=.env.local scripts/admin/grant-founding.mjs --store maya-books
//   Grant:                   node --env-file=.env.local scripts/admin/grant-founding.mjs --store maya-books --apply
//   Other length:            add  --months 3
//   List founding stores:    node --env-file=.env.local scripts/admin/grant-founding.mjs --list
//
// At most 10 founding stores at a time (FOUNDING_SPOTS in lib/config.ts); --force goes past that.
// Prints store usernames and dates only, never emails or the connection string.

import { MongoClient } from "mongodb";

// Keep in sync with FOUNDING_MONTHS and FOUNDING_SPOTS in lib/config.ts.
const FOUNDING_MONTHS = 6;
const FOUNDING_SPOTS = 10;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";

function out(line) {
  process.stdout.write(`${line}\n`);
}

const day = (date) => date.toISOString().slice(0, 10);

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

async function main() {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    out("MONGODB_URI is missing or not a mongodb:// URI. Pass --env-file=.env.local.");
    process.exitCode = 1;
    return;
  }
  const slug = value("store");
  const months = Number(value("months") ?? FOUNDING_MONTHS);
  if (!flag("list") && (!slug || !/^[a-z0-9-]{3,30}$/.test(slug))) {
    out("Pass --store <username> (the store link name), or --list.");
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    out("--months must be a whole number from 1 to 24.");
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const stores = client.db(dbName).collection("stores");
    const now = new Date();
    const founding = await stores
      .find({ planTier: "founding", foundingEndsAt: { $gt: now } }, { projection: { slug: 1, foundingEndsAt: 1 } })
      .sort({ foundingEndsAt: 1 })
      .toArray();

    out(`Database: ${dbName}`);
    out(`Founding stores now: ${founding.length} of ${FOUNDING_SPOTS}`);
    for (const store of founding) out(`  @${store.slug}  free until ${day(store.foundingEndsAt)}`);
    if (flag("list")) return;

    const store = await stores.findOne({ slug }, { projection: { _id: 1, slug: 1, planTier: 1, foundingEndsAt: 1 } });
    if (!store) {
      out(`No store with the username "${slug}".`);
      process.exitCode = 1;
      return;
    }
    const already = store.planTier === "founding" && store.foundingEndsAt > now;
    if (!already && founding.length >= FOUNDING_SPOTS && !flag("force")) {
      out(`All ${FOUNDING_SPOTS} founding spots are taken. Add --force to grant anyway.`);
      process.exitCode = 1;
      return;
    }

    const until = addMonths(now, months);
    out(`@${store.slug}: founding creator, free until ${day(until)} (${months} months from today)${already ? " (renewing)" : ""}.`);
    if (!flag("apply")) {
      out("Check only: nothing was written. Run again with --apply to grant.");
      return;
    }
    await stores.updateOne({ _id: store._id }, { $set: { planTier: "founding", foundingEndsAt: until, updatedAt: now } });
    out("Granted.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Failed: ${error?.name ?? "Error"}${error?.code ? ` (code ${error.code})` : ""}`);
  process.exitCode = 1;
});
