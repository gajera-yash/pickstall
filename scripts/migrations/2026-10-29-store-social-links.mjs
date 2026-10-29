// Migration (D-028): stores.link (one https link) -> stores.socialLinks ([{ kind, url }]).
//
// The founder runs this; it is never run automatically.
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/migrations/2026-10-29-store-social-links.mjs
//   Apply:                              node --env-file=.env.local scripts/migrations/2026-10-29-store-social-links.mjs --apply
//
// Safe to run more than once: it only touches stores that still have no `socialLinks` or still have
// a `link` field. It never deletes stores and never touches other collections. It prints counts
// only (no links, no connection string). The app reads the old `link` until this has run.

import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";

function out(line) {
  process.stdout.write(`${line}\n`);
}

/** The old field was validated as https on save; anything else is dropped, not copied. */
function isHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
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

    const needsLinks = await stores
      .find({ socialLinks: { $exists: false } }, { projection: { _id: 1, link: 1 } })
      .toArray();
    const onlyUnset = await stores.countDocuments({ socialLinks: { $exists: true }, link: { $exists: true } });

    let copied = 0;
    let empty = 0;
    let dropped = 0;
    const ops = needsLinks.map((doc) => {
      let socialLinks = [];
      if (isHttpsUrl(doc.link)) {
        socialLinks = [{ kind: "website", url: doc.link.trim() }];
        copied++;
      } else if (doc.link) {
        dropped++;
      } else {
        empty++;
      }
      return {
        updateOne: {
          filter: { _id: doc._id, socialLinks: { $exists: false } },
          update: { $set: { socialLinks }, $unset: { link: "" } },
        },
      };
    });

    out(`Database: ${dbName}`);
    out(`Stores without socialLinks: ${needsLinks.length} (link copied: ${copied}, no link: ${empty}, invalid link dropped: ${dropped})`);
    out(`Stores that already have socialLinks but still a link field: ${onlyUnset}`);

    if (!apply) {
      out("Dry run: nothing was written. Run again with --apply to migrate.");
      return;
    }

    let modified = 0;
    if (ops.length > 0) {
      const result = await stores.bulkWrite(ops, { ordered: false });
      modified += result.modifiedCount;
    }
    const cleanup = await stores.updateMany({ socialLinks: { $exists: true }, link: { $exists: true } }, { $unset: { link: "" } });
    modified += cleanup.modifiedCount;

    const remaining = await stores.countDocuments({ $or: [{ socialLinks: { $exists: false } }, { link: { $exists: true } }] });
    out(`Applied: ${modified} stores updated. Stores still needing migration: ${remaining}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
