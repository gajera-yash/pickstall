// Migration (D-047): remove pay-what-you-want. Every product keeps priceCents (for an old
// pay-what-you-want product that is its suggested price, which becomes its fixed price), gets
// salePriceCents: null when it has none, and loses pricingModel and minPriceCents.
//
// The founder runs this; it is never run automatically.
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/migrations/2026-11-remove-pwyw.mjs
//   Apply:                              node --env-file=.env.local scripts/migrations/2026-11-remove-pwyw.mjs --apply
//
// Safe to run more than once: it only touches products that still have an old field or no
// salePriceCents. It never deletes products, never changes a price and never touches other
// collections. It prints counts only. The app already sells such products at priceCents, so it
// works the same before and after this runs.

import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";

function out(line) {
  process.stdout.write(`${line}\n`);
}

const NEEDS = {
  $or: [{ pricingModel: { $exists: true } }, { minPriceCents: { $exists: true } }, { salePriceCents: { $exists: false } }],
};

async function main() {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    out("MONGODB_URI is missing or not a mongodb:// URI. Pass --env-file=.env.local.");
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const products = client.db(dbName).collection("products");

    const total = await products.countDocuments(NEEDS);
    const pwyw = await products.countDocuments({ pricingModel: "pwyw" });
    const pwywFree = await products.countDocuments({ pricingModel: "pwyw", priceCents: 0 });

    out(`Database: ${dbName}`);
    out(`Products to update: ${total}`);
    out(`  of which pay-what-you-want: ${pwyw} (they become fixed at their suggested price; ${pwywFree} of them had a suggested price of 0 and become free)`);

    if (!apply) {
      out("Dry run: nothing was written. Run again with --apply to migrate.");
      return;
    }

    // Two steps so a product that already has a discount keeps it.
    const unset = await products.updateMany(
      { $or: [{ pricingModel: { $exists: true } }, { minPriceCents: { $exists: true } }] },
      { $unset: { pricingModel: "", minPriceCents: "" } },
    );
    const sale = await products.updateMany({ salePriceCents: { $exists: false } }, { $set: { salePriceCents: null } });

    const remaining = await products.countDocuments(NEEDS);
    out(`Applied: old fields removed from ${unset.modifiedCount} products, salePriceCents added to ${sale.modifiedCount}. Still needing migration: ${remaining}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
