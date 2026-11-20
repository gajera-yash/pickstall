import "server-only";

import { collections, type PlanPaymentDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import type { PlanInvoiceState } from "@/lib/payments/billing";

// Plan payments (D-116): what creators paid Pickstall for plans, saved from verified `invoice.paid`
// webhooks on our own account (or the admin's import). Platform revenue only; no creator money.

/** Saves one paid plan invoice once. True when it was new. */
export async function savePlanPayment(invoice: PlanInvoiceState, now: Date = new Date()): Promise<boolean> {
  const { planPayments, stores } = await collections();
  // The store from the subscription metadata, else the store that has this Stripe customer.
  const storeId = invoice.storeId ?? (await stores.findOne({ "billing.customerId": invoice.customerId }, { projection: { _id: 1 } }))?._id ?? null;
  const doc: PlanPaymentDoc = {
    _id: invoice.invoiceId,
    storeId,
    customerId: invoice.customerId,
    subscriptionId: invoice.subscriptionId,
    plan: invoice.plan,
    amountCents: invoice.amountPaidCents,
    currency: invoice.currency,
    paidAt: invoice.paidAt,
    createdAt: now,
  };
  try {
    await planPayments.insertOne(doc);
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

/** A store's plan payments, newest first (admin creator page). */
export async function planPaymentsOfStore(storeId: string, limit = 24): Promise<PlanPaymentDoc[]> {
  const { planPayments } = await collections();
  return planPayments.find({ storeId }).sort({ paidAt: -1 }).limit(limit).toArray();
}
