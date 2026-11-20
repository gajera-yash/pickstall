import "server-only";

import { randomUUID } from "node:crypto";

import type { CourseAccess } from "@/lib/courses/student";
import { collections, type CertificateDoc } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/db/mongo";
import { isUuid } from "@/lib/media/media";

// Course certificates (D-111). Issuing needs an order the caller has checked with `courseAccess`;
// the public page reads one by its random id and shows only what is printed on it.

export type StudentCertificate = { id: string; studentName: string; issuedAt: Date };

/** This order's certificate, if one was issued. */
export async function certificateOfOrder(orderId: string): Promise<StudentCertificate | null> {
  const { certificates } = await collections();
  const doc = await certificates.findOne({ orderId }, { projection: { studentName: 1, issuedAt: 1 } });
  return doc ? { id: doc._id, studentName: doc.studentName, issuedAt: doc.issuedAt } : null;
}

/**
 * Issues the certificate for an order, once. A second claim (two tabs, a double click) gets the
 * certificate already issued: the unique index on `orderId` decides, not a check before writing.
 */
export async function issueCertificate(
  access: Extract<CourseAccess, { ok: true }>,
  details: { studentName: string; courseTitle: string; storeName: string },
  now: Date = new Date(),
): Promise<StudentCertificate> {
  const { certificates } = await collections();
  const doc: CertificateDoc = { _id: randomUUID(), orderId: access.orderId, storeId: access.storeId, productId: access.courseId, ...details, issuedAt: now };
  try {
    await certificates.insertOne(doc);
    return { id: doc._id, studentName: doc.studentName, issuedAt: doc.issuedAt };
  } catch (error) {
    if (isDuplicateKeyError(error, "orderId")) {
      const existing = await certificateOfOrder(access.orderId);
      if (existing) return existing;
    }
    throw error;
  }
}

export type PublicCertificate = { id: string; studentName: string; courseTitle: string; storeName: string; issuedAt: Date; revoked: boolean };

/** A certificate for its public page: what is printed on it, and whether a refund revoked it. */
export async function publicCertificate(id: string): Promise<PublicCertificate | null> {
  if (!isUuid(id)) return null;
  const { certificates, orders } = await collections();
  const doc = await certificates.findOne({ _id: id });
  if (!doc) return null;
  const order = await orders.findOne({ _id: doc.orderId, storeId: doc.storeId }, { projection: { status: 1 } });
  return { id: doc._id, studentName: doc.studentName, courseTitle: doc.courseTitle, storeName: doc.storeName, issuedAt: doc.issuedAt, revoked: !order || order.status !== "paid" };
}

/** The buyer's name from checkout, to fill in the certificate form (the caller has checked access). */
export async function buyerNameOfOrder(orderId: string): Promise<string> {
  const { orders } = await collections();
  const order = await orders.findOne({ _id: orderId }, { projection: { buyerName: 1 } });
  return order?.buyerName ?? "";
}
