import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

// Coaching calls, part K1 (D-081): settings rules, the editor payload, the publish rule and the
// coaching actions (always the session owner's store).

const coachingQueries = vi.hoisted(() => ({ updateCoachingDetails: vi.fn() }));
vi.mock("@/lib/plans/usage", () => ({ countCourses: vi.fn(async () => 0), countPublishedCourses: vi.fn(async () => 0), videoSecondsUsed: vi.fn(async () => 0) }));
vi.mock("@/lib/coaching/queries", () => coachingQueries);
const productQueries = vi.hoisted(() => ({ createDraftProduct: vi.fn() }));
vi.mock("@/lib/products/queries", () => productQueries);

import { createCoachingAndEdit, saveCoachingDetails } from "@/lib/coaching/actions";
import { coachingStepOfField, nextCoachingStep, previousCoachingStep } from "@/lib/coaching/editor-steps";
import { coachingDetailsInputFor } from "@/lib/coaching/schemas";
import { availabilityProblems, defaultCoachingSettings, durationLabel, isValidTimeZone, minutesOf, weeklySummary } from "@/lib/coaching/settings";
import { publishProblems } from "@/lib/products/publish";

const CALL_ID = "6c1d7e3f-0000-4000-8000-000000000001";

const valid = {
  title: "1:1 portfolio review",
  descriptionDoc: null,
  coverUrl: "",
  durationMinutes: 30,
  timeZone: "Asia/Kolkata",
  weekly: [
    { day: 3, start: "14:00", end: "17:00" },
    { day: 1, start: "09:00", end: "12:00" },
  ],
  bufferMinutes: 10,
  minNoticeHours: 12,
  bookingWindowDays: 30,
  meeting: "link",
  meetingUrl: "https://zoom.us/j/123456789",
  pricing: "paid",
  price: "49.00",
  discountOn: false,
  salePrice: "",
};

describe("coaching settings", () => {
  it("reads HH:MM times and rejects anything else", () => {
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("24:00")).toBe(1440);
    expect(minutesOf("9:30")).toBeNull();
    expect(minutesOf("25:00")).toBeNull();
  });

  it("knows real time zones only", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("starts new calls on weekdays 9 to 5, 30 minutes, link sent later", () => {
    const settings = defaultCoachingSettings();
    expect(settings.weekly).toHaveLength(5);
    expect(availabilityProblems(settings.weekly, settings.durationMinutes)).toEqual([]);
    expect(settings.meetingUrl).toBeNull();
    expect(settings.timeZone).toBeNull();
  });

  it("checks the weekly hours the way a creator would fix them", () => {
    expect(availabilityProblems([], 30)).toEqual(["Open at least one day for calls."]);
    expect(availabilityProblems([{ day: 1, start: "12:00", end: "09:00" }], 30)).toEqual(["Monday: the end time must be after the start time."]);
    expect(availabilityProblems([{ day: 2, start: "09:00", end: "09:20" }], 30)).toEqual(["Tuesday: each time range must fit at least one 30-minute call."]);
    expect(availabilityProblems([{ day: 3, start: "09:03", end: "10:00" }], 30)).toEqual(["Wednesday: use times in 5-minute steps."]);
    expect(availabilityProblems([{ day: 4, start: "9am", end: "10:00" }], 30)).toEqual(["Thursday: enter times like 09:00."]);
    expect(
      availabilityProblems(
        [
          { day: 5, start: "09:00", end: "11:00" },
          { day: 5, start: "10:00", end: "12:00" },
        ],
        30,
      ),
    ).toEqual(["Friday: time ranges must not overlap."]);
    const four = ["08:00", "10:00", "12:00", "14:00"].map((start) => ({ day: 6, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` }));
    expect(availabilityProblems(four, 30)).toEqual(["Saturday: use up to 3 time ranges."]);
    expect(availabilityProblems([{ day: 8, start: "09:00", end: "10:00" }], 30)).toEqual(["Pick days from the list."]);
  });

  it("labels lengths and weekly hours", () => {
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(60)).toBe("1 h");
    expect(durationLabel(90)).toBe("1 h 30 min");
    expect(weeklySummary(defaultCoachingSettings().weekly)).toBe("5 days a week, 40 hours");
    expect(weeklySummary([])).toBe("No days open yet");
  });
});

describe("coaching editor payload", () => {
  const parse = (overrides: Record<string, unknown> = {}) => coachingDetailsInputFor("usd").safeParse({ ...valid, ...overrides });

  it("saves a valid call with its hours sorted and the price in cents", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priceCents).toBe(4900);
    expect(result.data.coaching.weekly.map((window) => window.day)).toEqual([1, 3]);
    expect(result.data.coaching).toMatchObject({ timeZone: "Asia/Kolkata", durationMinutes: 30, bufferMinutes: 10, meetingUrl: "https://zoom.us/j/123456789" });
  });

  it("drops the link when the coach sends it later, and makes free calls cost 0", () => {
    const result = parse({ meeting: "later", pricing: "free", price: "49.00", discountOn: true, salePrice: "10" });
    expect(result.success && result.data.coaching.meetingUrl).toBeNull();
    expect(result.success && [result.data.priceCents, result.data.salePriceCents]).toEqual([0, null]);
  });

  it.each([
    [{ durationMinutes: 20 }, "durationMinutes"],
    [{ timeZone: "Mars/Base" }, "timeZone"],
    [{ bufferMinutes: 7 }, "bufferMinutes"],
    [{ minNoticeHours: 3 }, "minNoticeHours"],
    [{ bookingWindowDays: 365 }, "bookingWindowDays"],
    [{ meetingUrl: "http://zoom.us/j/1" }, "meetingUrl"],
    [{ meetingUrl: "javascript:alert(1)" }, "meetingUrl"],
    [{ meetingUrl: "" }, "meetingUrl"],
    [{ weekly: [] }, "weekly"],
    [{ weekly: [{ day: 1, start: "10:00", end: "09:00" }] }, "weekly"],
    [{ price: "0" }, "price"],
    [{ discountOn: true, salePrice: "60" }, "salePrice"],
    [{ title: "" }, "title"],
  ])("rejects %o on the %s field", (overrides, field) => {
    const result = parse(overrides);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });

  it("maps each field to its step", () => {
    expect(coachingStepOfField("durationMinutes")).toBe("details");
    expect(coachingStepOfField("weekly")).toBe("availability");
    expect(coachingStepOfField("meetingUrl")).toBe("availability");
    expect(coachingStepOfField("price")).toBe("publish");
    expect(coachingStepOfField(undefined)).toBeNull();
    expect(nextCoachingStep("details")).toBe("availability");
    expect(nextCoachingStep("publish")).toBeNull();
    expect(previousCoachingStep("details")).toBeNull();
  });
});

describe("publishing a coaching call", () => {
  const call = {
    type: "coaching" as const,
    title: "1:1 portfolio review",
    priceCents: 0,
    salePriceCents: null,
    externalUrl: null,
    deliveryType: "link" as const,
    fileId: null,
    coaching: { ...defaultCoachingSettings(), timeZone: "Asia/Kolkata" },
  };

  it("can be published with valid hours and a time zone, without asking for a file or link (D-083)", () => {
    expect(publishProblems(call, true)).toEqual([]);
    expect(publishProblems({ ...call, priceCents: 4900 }, false)).toEqual(["Connect payments to publish a paid product."]);
  });

  it("also lists a missing time zone and broken hours", () => {
    const problems = publishProblems({ ...call, coaching: { ...call.coaching, timeZone: null, weekly: [] } }, true);
    expect(problems).toEqual(["Pick your time zone.", "Open at least one day for calls."]);
  });
});

describe("coaching actions use the session owner's store only", () => {
  const form = (overrides: Record<string, unknown> = {}) => formData({ payload: JSON.stringify({ ...valid, ...overrides }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ access: { state: "trial", endsAt: null, daysLeft: null, plan: null, cancelsAtPeriodEnd: false }, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
    rateLimit.takeRateLimit.mockResolvedValue(true);
  });

  it("creates a draft coaching call in the session's store and opens it", async () => {
    productQueries.createDraftProduct.mockResolvedValue({ id: CALL_ID });
    expect(await redirectOf(() => createCoachingAndEdit())).toBe(`/dashboard/products/${CALL_ID}`);
    expect(productQueries.createDraftProduct).toHaveBeenCalledWith("store-1", { buttonText: "Book a call", type: "coaching" });
  });

  it("does not create a call on a plan without coaching (D-098)", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue({
      access: { state: "active", endsAt: null, daysLeft: null, plan: "starter", cancelsAtPeriodEnd: false },
      id: "store-1",
      slug: "maya",
      currency: "usd",
      stripeChargesEnabled: false,
    });
    expect(await redirectOf(() => createCoachingAndEdit())).toBe("/dashboard/products?error=plan_coaching");
    expect(productQueries.createDraftProduct).not.toHaveBeenCalled();
  });

  it("saves with the session's store id, ignoring any storeId in the payload", async () => {
    coachingQueries.updateCoachingDetails.mockResolvedValue("saved");
    expect(await saveCoachingDetails(CALL_ID, null, form({ storeId: "someone-else" }))).toMatchObject({ ok: true });
    expect(coachingQueries.updateCoachingDetails).toHaveBeenCalledWith("store-1", CALL_ID, expect.objectContaining({ priceCents: 4900 }));
    expect(JSON.stringify(coachingQueries.updateCoachingDetails.mock.calls[0])).not.toContain("someone-else");
  });

  it("answers 'not found' for another creator's call or a different product type", async () => {
    coachingQueries.updateCoachingDetails.mockResolvedValue("not_found");
    expect(await saveCoachingDetails(CALL_ID, null, form())).toMatchObject({ ok: false });
  });

  it("returns the field of the first problem and saves nothing", async () => {
    expect(await saveCoachingDetails(CALL_ID, null, form({ timeZone: "Nowhere/Land" }))).toMatchObject({ ok: false, field: "timeZone" });
    expect(await saveCoachingDetails("not-a-uuid", null, form())).toMatchObject({ ok: false });
    expect(await saveCoachingDetails(CALL_ID, null, formData({ payload: "{oops" }))).toMatchObject({ ok: false });
    expect(coachingQueries.updateCoachingDetails).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await saveCoachingDetails(CALL_ID, null, form())).toMatchObject({ ok: false });
    expect(coachingQueries.updateCoachingDetails).not.toHaveBeenCalled();
  });
});
