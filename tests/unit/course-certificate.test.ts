import { MongoServerError } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, userId } from "./auth-mocks";

// D-111: course certificates: the finish rule, claiming once, the name rules and the public page.

const db = vi.hoisted(() => {
  const coll = () => ({ find: vi.fn(), findOne: vi.fn(), insertOne: vi.fn(), updateOne: vi.fn() });
  return { orders: coll(), products: coll(), stores: coll(), lessonProgress: coll(), certificates: coll() };
});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", async () => {
  const { MongoServerError: Duplicate } = await import("mongodb");
  return { isDuplicateKeyError: (error: unknown) => error instanceof Duplicate && error.code === 11000 };
});
const player = vi.hoisted(() => ({ loadPlayerCourse: vi.fn(), buildOutline: vi.fn() }));
vi.mock("@/lib/courses/player", () => player);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { claimCertificate } from "@/lib/certificates/actions";
import { publicCertificate } from "@/lib/certificates/queries";
import { certificateNameInput, courseFinished } from "@/lib/certificates/rules";

const ORDER = "11111111-0000-4000-8000-000000000001";
const COURSE = "5b0c6d2e-0000-4000-8000-000000000001";
const CERT = "cccccccc-0000-4000-8000-000000000001";
const L1 = "bbbbbbbb-0000-4000-8000-000000000001";
const L2 = "bbbbbbbb-0000-4000-8000-000000000002";
const paidAt = new Date("2026-11-01T00:00:00Z");

const progress = (ids: string[]) => db.lessonProgress.find.mockReturnValue({ toArray: async () => ids.map((lessonId) => ({ lessonId })) });
const course = (certificate: boolean | undefined) => player.loadPlayerCourse.mockResolvedValue({ product: { _id: COURSE, title: "Figma basics", course: { certificate } }, modules: [], lessons: [], files: [] });

beforeEach(() => {
  vi.clearAllMocks();
  db.orders.findOne.mockResolvedValue({ _id: ORDER, productId: COURSE, storeId: "store-1", status: "paid", paidAt });
  db.products.findOne.mockResolvedValue({ _id: COURSE, type: "course", course: { accessDays: null } });
  db.stores.findOne.mockResolvedValue({ name: "Maya Studio" });
  db.certificates.findOne.mockResolvedValue(null);
  db.certificates.insertOne.mockResolvedValue({});
  mockSession({ id: userId, email: "student@example.com" });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  course(true);
  player.buildOutline.mockReturnValue({ modules: [], lessonIds: [L1, L2] });
  progress([L1, L2]);
});

describe("certificate rules", () => {
  it("need every lesson complete, and at least one lesson", () => {
    expect(courseFinished([L1, L2], [L2, L1, "old-lesson"])).toBe(true);
    expect(courseFinished([L1, L2], [L1])).toBe(false);
    expect(courseFinished([], [])).toBe(false);
  });

  it("clean the name and limit its length", () => {
    expect(certificateNameInput.parse("  <b>Asha</b>   Patel ")).toBe("Asha Patel");
    expect(certificateNameInput.safeParse("A").success).toBe(false);
    expect(certificateNameInput.safeParse("x".repeat(81)).success).toBe(false);
  });
});

describe("claiming a certificate", () => {
  it("issues one with the cleaned name, the course title and the store name", async () => {
    const result = await claimCertificate(ORDER, " Asha <i>Patel</i> ");
    expect(result).toMatchObject({ ok: true, data: { studentName: "Asha Patel" } });
    expect(db.certificates.insertOne).toHaveBeenCalledWith(expect.objectContaining({ orderId: ORDER, storeId: "store-1", productId: COURSE, studentName: "Asha Patel", courseTitle: "Figma basics", storeName: "Maya Studio" }));
    expect(db.stores.findOne.mock.calls[0]?.[0]).toEqual({ _id: "store-1" });
  });

  it("gives back the certificate already issued, without a new name", async () => {
    db.certificates.findOne.mockResolvedValue({ _id: CERT, studentName: "Asha Patel", issuedAt: paidAt });
    expect(await claimCertificate(ORDER, "Someone Else")).toEqual({ ok: true, data: { id: CERT, studentName: "Asha Patel", issuedAt: paidAt } });
    expect(db.certificates.insertOne).not.toHaveBeenCalled();
  });

  it("returns the existing certificate when two claims race (unique order index)", async () => {
    db.certificates.insertOne.mockRejectedValue(new MongoServerError({ message: "E11000", code: 11000 }));
    db.certificates.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: CERT, studentName: "Asha Patel", issuedAt: paidAt });
    expect(await claimCertificate(ORDER, "Asha Patel")).toEqual({ ok: true, data: { id: CERT, studentName: "Asha Patel", issuedAt: paidAt } });
  });

  it("refuses an unfinished course, a course without certificates, a bad name and too many tries", async () => {
    progress([L1]);
    expect(await claimCertificate(ORDER, "Asha Patel")).toMatchObject({ ok: false, error: "Finish every lesson to get your certificate." });
    progress([L1, L2]);
    course(undefined);
    expect(await claimCertificate(ORDER, "Asha Patel")).toMatchObject({ ok: false, error: "This course doesn't give certificates." });
    course(true);
    expect(await claimCertificate(ORDER, " ")).toMatchObject({ ok: false, field: "name" });
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await claimCertificate(ORDER, "Asha Patel")).toMatchObject({ ok: false });
    expect(db.certificates.insertOne).not.toHaveBeenCalled();
  });

  it("refuses another email's order and a refunded one", async () => {
    db.orders.findOne.mockResolvedValueOnce(null);
    expect(await claimCertificate(ORDER, "Asha Patel")).toMatchObject({ ok: false });
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, buyerEmail: "student@example.com" });
    db.orders.findOne.mockResolvedValueOnce({ _id: ORDER, productId: COURSE, storeId: "store-1", status: "refunded", paidAt });
    expect(await claimCertificate(ORDER, "Asha Patel")).toMatchObject({ ok: false, error: expect.stringMatching(/refunded/) });
    expect(db.certificates.insertOne).not.toHaveBeenCalled();
  });
});

describe("the public certificate", () => {
  const doc = { _id: CERT, orderId: ORDER, storeId: "store-1", productId: COURSE, studentName: "Asha Patel", courseTitle: "Figma basics", storeName: "Maya Studio", issuedAt: paidAt };

  it("shows only what is printed on it", async () => {
    db.certificates.findOne.mockResolvedValue(doc);
    expect(await publicCertificate(CERT)).toEqual({ id: CERT, studentName: "Asha Patel", courseTitle: "Figma basics", storeName: "Maya Studio", issuedAt: paidAt, revoked: false });
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, storeId: "store-1" });
  });

  it("is revoked after a refund, and unknown or malformed ids find nothing", async () => {
    db.certificates.findOne.mockResolvedValue(doc);
    db.orders.findOne.mockResolvedValue({ status: "refunded" });
    expect(await publicCertificate(CERT)).toMatchObject({ revoked: true });
    expect(await publicCertificate("not-a-uuid")).toBeNull();
    db.certificates.findOne.mockResolvedValue(null);
    expect(await publicCertificate(CERT)).toBeNull();
  });
});
