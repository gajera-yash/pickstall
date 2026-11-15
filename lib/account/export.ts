import "server-only";

import { collections } from "@/lib/db/collections";

// "Download my data" (D-074): everything we hold about the signed-in person, as JSON (GDPR / UK GDPR
// access and portability, CCPA right to know, DPDP Act access). Every read is keyed by the session's
// user id or verified email, never by input. Sign-in secrets (password hashes, sessions, codes) are
// not included: they are not useful to the person and would weaken their account if the file leaked.

const MAX_ROWS = 10_000;

export type UserDataExport = {
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: Record<string, unknown> | null;
  store: Record<string, unknown> | null;
  products: Record<string, unknown>[];
  salesAsCreator: Record<string, unknown>[];
  purchasesAsBuyer: Record<string, unknown>[];
};

/** Fields kept out of the export: internal keys that mean nothing outside Pickstall. */
const INTERNAL_STORE_FIELDS = { ownerEmailKey: 0, stripeClaimKey: 0 } as const;

export async function exportUserData(user: { id: string; email: string | null }, now = new Date()): Promise<UserDataExport> {
  const { profiles, stores, products, orders } = await collections();
  const [profile, store] = await Promise.all([
    profiles.findOne({ _id: user.id }),
    stores.findOne({ ownerId: user.id }, { projection: INTERNAL_STORE_FIELDS }),
  ]);
  const [ownProducts, sales, purchases] = await Promise.all([
    store ? products.find({ storeId: store._id }).limit(MAX_ROWS).toArray() : [],
    store ? orders.find({ storeId: store._id }).sort({ createdAt: -1 }).limit(MAX_ROWS).toArray() : [],
    user.email
      ? orders
          .find({ buyerEmail: user.email.toLowerCase() }, { projection: { _id: 1, storeId: 1, item: 1, totalCents: 1, currency: 1, status: 1, createdAt: 1, paidAt: 1, answers: 1 } })
          .sort({ createdAt: -1 })
          .limit(MAX_ROWS)
          .toArray()
      : [],
  ]);
  return {
    exportedAt: now.toISOString(),
    account: { id: user.id, email: user.email },
    profile,
    store,
    products: ownProducts,
    salesAsCreator: sales,
    purchasesAsBuyer: purchases,
  };
}
