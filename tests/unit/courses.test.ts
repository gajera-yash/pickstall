import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

// Course flow G1 (D-054): the Basic and Pricing steps, the step helpers, the publish rule and the
// course actions.

const courseQueries = vi.hoisted(() => ({ updateCourseDetails: vi.fn() }));
vi.mock("@/lib/courses/queries", () => courseQueries);
const productQueries = vi.hoisted(() => ({ createDraftProduct: vi.fn() }));
vi.mock("@/lib/products/queries", () => productQueries);

import { createCourseAndEdit, saveCourseDetails } from "@/lib/courses/actions";
import { basicsMissing, courseStepOfField, nextCourseStep, pricingMissing } from "@/lib/courses/editor-steps";
import { courseDetailsInputFor } from "@/lib/courses/schemas";
import { accessLabel } from "@/lib/courses/settings";
import { publishProblems } from "@/lib/products/publish";

const COURSE_ID = "5b0c6d2e-0000-4000-8000-000000000001";

const valid = {
  title: "Advanced UI/UX Design Masterclass",
  descriptionDoc: null,
  coverUrl: "",
  category: "design",
  tags: ["figma", "beginners"],
  pricing: "paid",
  price: "49.00",
  discountOn: false,
  salePrice: "",
  access: "lifetime",
  accessDays: "",
};

const parse = (overrides: Record<string, unknown> = {}, currency = "usd") => courseDetailsInputFor(currency).safeParse({ ...valid, ...overrides });
const firstIssue = (result: ReturnType<typeof parse>) => (result.success ? null : { field: result.error.issues[0]?.path[0], message: result.error.issues[0]?.message });

describe("course details input", () => {
  it("reads a paid course with lifetime access", () => {
    const result = parse();
    expect(result.success && result.data).toMatchObject({
      title: "Advanced UI/UX Design Masterclass",
      priceCents: 4900,
      salePriceCents: null,
      course: { category: "design", tags: ["figma", "beginners"], accessDays: null },
    });
  });

  it("makes a free course cost 0 and ignores any price or discount sent with it", () => {
    const result = parse({ pricing: "free", price: "99", discountOn: true, salePrice: "10" });
    expect(result.success && result.data).toMatchObject({ priceCents: 0, salePriceCents: null });
  });

  it("needs a paid course to cost more than 0", () => {
    expect(firstIssue(parse({ price: "0" }))).toMatchObject({ field: "price" });
    expect(firstIssue(parse({ price: "abc" }))).toMatchObject({ field: "price" });
  });

  it("checks the discount like a product's (D-047)", () => {
    expect(parse({ discountOn: true, salePrice: "29" }).data).toMatchObject({ priceCents: 4900, salePriceCents: 2900 });
    expect(firstIssue(parse({ discountOn: true, salePrice: "49" }))).toMatchObject({ field: "salePrice" });
  });

  it("uses the store's own currency, whole units for JPY (D-046)", () => {
    expect(parse({ price: "5000" }, "jpy").data).toMatchObject({ priceCents: 5000 });
    expect(firstIssue(parse({ price: "5000.50" }, "jpy"))).toMatchObject({ field: "price" });
  });

  it("reads a limited access period and refuses one out of range", () => {
    expect(parse({ access: "days", accessDays: "365" }).data).toMatchObject({ course: { accessDays: 365 } });
    expect(firstIssue(parse({ access: "days", accessDays: "0" }))).toMatchObject({ field: "accessDays" });
    expect(firstIssue(parse({ access: "days", accessDays: "99999" }))).toMatchObject({ field: "accessDays" });
    expect(parse({ access: "lifetime", accessDays: "abc" }).data).toMatchObject({ course: { accessDays: null } });
  });

  it("cleans tags and allows at most 5 different ones", () => {
    expect(parse({ tags: [" <b>figma</b> ", "", "ui   design"] }).data).toMatchObject({ course: { tags: ["figma", "ui design"] } });
    expect(firstIssue(parse({ tags: ["a", "b", "c", "d", "e", "f"] }))).toMatchObject({ field: "tags" });
    expect(firstIssue(parse({ tags: ["Figma", "figma"] }))).toMatchObject({ field: "tags" });
    expect(firstIssue(parse({ tags: ["x".repeat(25)] }))).toMatchObject({ field: "tags" });
  });

  it("allows only the fixed categories, or none", () => {
    expect(parse({ category: "" }).data).toMatchObject({ course: { category: null } });
    expect(firstIssue(parse({ category: "gambling" }))).toMatchObject({ field: "category" });
  });

  it("needs a title and strips tags from it", () => {
    expect(firstIssue(parse({ title: "   " }))).toMatchObject({ field: "title" });
    expect(parse({ title: "<script>x</script>Design" }).data).toMatchObject({ title: expect.not.stringContaining("<") });
  });
});

describe("course editor steps", () => {
  it("opens the step that holds a field with a problem", () => {
    expect(courseStepOfField("category")).toBe("basic");
    expect(courseStepOfField("accessDays")).toBe("pricing");
    expect(courseStepOfField("nope")).toBeNull();
    expect(nextCourseStep("pricing")).toBe("curriculum");
    expect(nextCourseStep("publish")).toBeNull();
  });

  it("lists what each step still needs", () => {
    expect(basicsMissing({ title: " ", category: "" })).toHaveLength(2);
    expect(basicsMissing({ title: "Course", category: "design" })).toEqual([]);
    expect(pricingMissing({ pricing: "free", priceCents: null, access: "lifetime", accessDays: "" })).toEqual([]);
    expect(pricingMissing({ pricing: "paid", priceCents: 0, access: "days", accessDays: "" })).toHaveLength(2);
  });

  it("labels the access period", () => {
    expect(accessLabel(null)).toBe("Lifetime access");
    expect(accessLabel(1)).toBe("1 day of access");
    expect(accessLabel(365)).toBe("365 days of access");
  });
});

describe("course publish rule", () => {
  const course = { type: "course" as const, title: "Course", priceCents: 0, salePriceCents: null, externalUrl: null, deliveryType: "link" as const, fileId: null };

  it("keeps a course unpublished until it has lessons (G3)", () => {
    expect(publishProblems(course, true)).toEqual(["Add lessons to your course. The curriculum builder comes next."]);
  });

  it("leaves the digital product rules as they were", () => {
    expect(publishProblems({ ...course, type: "digital", externalUrl: "https://example.com/file" }, true)).toEqual([]);
  });
});

describe("course actions use the session owner's store only", () => {
  const form = (overrides: Record<string, unknown> = {}) => formData({ payload: JSON.stringify({ ...valid, ...overrides }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
    rateLimit.takeRateLimit.mockResolvedValue(true);
  });

  it("creates a draft course in the session's store and opens it", async () => {
    productQueries.createDraftProduct.mockResolvedValue({ id: COURSE_ID });
    expect(await redirectOf(() => createCourseAndEdit())).toBe(`/dashboard/products/${COURSE_ID}`);
    expect(productQueries.createDraftProduct).toHaveBeenCalledWith("store-1", { buttonText: "Enroll now", type: "course" });
  });

  it("saves with the session's store id, ignoring any storeId in the payload", async () => {
    courseQueries.updateCourseDetails.mockResolvedValue("saved");
    expect(await saveCourseDetails(COURSE_ID, null, form({ storeId: "someone-else" }))).toMatchObject({ ok: true });
    expect(courseQueries.updateCourseDetails).toHaveBeenCalledWith("store-1", COURSE_ID, expect.objectContaining({ priceCents: 4900 }));
    expect(JSON.stringify(courseQueries.updateCourseDetails.mock.calls[0])).not.toContain("someone-else");
  });

  it("answers 'not found' for another creator's course or a digital product", async () => {
    courseQueries.updateCourseDetails.mockResolvedValue("not_found");
    expect(await saveCourseDetails(COURSE_ID, null, form())).toMatchObject({ ok: false });
  });

  it("returns the field of the first problem and saves nothing", async () => {
    expect(await saveCourseDetails(COURSE_ID, null, form({ price: "0" }))).toMatchObject({ ok: false, field: "price" });
    expect(await saveCourseDetails("not-a-uuid", null, form())).toMatchObject({ ok: false });
    expect(await saveCourseDetails(COURSE_ID, null, formData({ payload: "{oops" }))).toMatchObject({ ok: false });
    expect(courseQueries.updateCourseDetails).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await saveCourseDetails(COURSE_ID, null, form())).toMatchObject({ ok: false });
    expect(courseQueries.updateCourseDetails).not.toHaveBeenCalled();
  });
});
