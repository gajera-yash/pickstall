// Migration (D-072): give stores created before the free trial existed a trial of TRIAL_DAYS, counted
// from the day this runs, so no existing creator is paused the moment the trial ships.
//
// The founder runs this; it is never run automatically.
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/migrations/2026-11-15-store-trials.mjs
//   Apply:                              node --env-file=.env.local scripts/migrations/2026-11-15-store-trials.mjs --apply
//
// Safe to run more than once: it only touches stores without `trialEndsAt` and never changes a store
// that already has a trial or a founding grant. It prints counts only.

import { MongoClient } from "mongodb";

// Keep in sync with TRIAL_DAYS in lib/config.ts.
const TRIAL_DAYS = 30;

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";

function out(line) {
  process.stdout.write(`${line}\n`);
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
    const stores = client.db(dbName).collection("stores");
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const filter = { trialEndsAt: { $exists: false } };
    const missing = await stores.countDocuments(filter);
    const founding = await stores.countDocuments({ ...filter, planTier: "founding" });

    out(`Database: ${dbName}`);
    out(`Stores without a trial date: ${missing} (of which founding: ${founding})`);
    out(`They get a free trial until ${trialEndsAt.toISOString().slice(0, 10)} (${TRIAL_DAYS} days from today).`);

    if (!apply) {
      out("Dry run: nothing was written. Run again with --apply to migrate.");
      return;
    }
    // Founding stores keep their plan; they only get the trial date as a fallback after the grant ends.
    const trial = await stores.updateMany({ ...filter, planTier: { $ne: "founding" } }, { $set: { planTier: "trial", trialEndsAt, updatedAt: now } });
    const fallback = await stores.updateMany({ ...filter, planTier: "founding" }, { $set: { trialEndsAt, updatedAt: now } });
    out(`Applied: ${trial.modifiedCount + fallback.modifiedCount} stores updated. Still without a trial date: ${await stores.countDocuments(filter)}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Migration failed: ${error?.name ?? "Error"}${error?.code ? ` (code ${error.code})` : ""}`);
  process.exitCode = 1;
});
