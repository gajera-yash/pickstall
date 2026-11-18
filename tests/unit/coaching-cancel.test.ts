import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, storeQueries, userId } from "./auth-mocks";

// Cancel a coaching call (D-086): only the session's store, refund first, then cancel and email.

const calls = vi.hoisted(() => ({ findOrderCall: vi.fn(), cancelBooking: vi.fn(), scheduleCallCancelledEmail: vi.fn() }));
const refunds = vi.hoisted(() => ({ requestFullRefund: vi.fn() }));
vi.mock("@/lib/coaching/calls", () => calls);
vi.mock("@/lib/orders/refunds", () => refunds);

import { cancelCall } from "@/lib/coaching/call-actions";

const ORDER = "7d1e8f2a-0000-4000-8000-000000000001";
const booked = { start: new Date("2032-01-01T04:30:00Z"), end: new Date("2032-01-01T05:00:00Z"), status: "confirmed", timeZone: "UTC" };

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  calls.findOrderCall.mockResolvedValue(booked);
  calls.cancelBooking.mockResolvedValue(true);
  refunds.requestFullRefund.mockResolvedValue("requested");
});

describe("cancelCall", () => {
  it("refunds, then cancels and emails, always with the session's store", async () => {
    expect(await cancelCall(ORDER)).toEqual({ ok: true, data: { refunded: true } });
    expect(calls.findOrderCall).toHaveBeenCalledWith("store-1", ORDER);
    expect(refunds.requestFullRefund).toHaveBeenCalledWith("store-1", ORDER);
    expect(calls.cancelBooking).toHaveBeenCalledWith("store-1", ORDER);
    expect(calls.scheduleCallCancelledEmail).toHaveBeenCalledWith(ORDER, true);
    expect(refunds.requestFullRefund.mock.invocationCallOrder[0]).toBeLessThan(calls.cancelBooking.mock.invocationCallOrder[0] as number);
  });

  it("cancels a free call without a refund", async () => {
    refunds.requestFullRefund.mockResolvedValue("not_refundable");
    expect(await cancelCall(ORDER)).toEqual({ ok: true, data: { refunded: false } });
    expect(calls.scheduleCallCancelledEmail).toHaveBeenCalledWith(ORDER, false);
  });

  it("keeps the call when the refund fails", async () => {
    refunds.requestFullRefund.mockRejectedValue(new Error("stripe down"));
    const result = await cancelCall(ORDER);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("stripe down");
    expect(calls.cancelBooking).not.toHaveBeenCalled();
  });

  it("refuses another store's order, a cancelled call, a bad id and too many requests", async () => {
    calls.findOrderCall.mockResolvedValueOnce(null);
    expect((await cancelCall(ORDER)).ok).toBe(false);
    calls.findOrderCall.mockResolvedValueOnce({ ...booked, status: "cancelled" });
    expect((await cancelCall(ORDER)).ok).toBe(false);
    expect((await cancelCall("../x")).ok).toBe(false);
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect((await cancelCall(ORDER)).ok).toBe(false);
    expect(refunds.requestFullRefund).not.toHaveBeenCalled();
    expect(calls.cancelBooking).not.toHaveBeenCalled();
  });
});
