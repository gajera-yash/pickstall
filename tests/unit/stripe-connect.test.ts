import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, storeQueries, testAccount as stripe, userId } from "./auth-mocks";

import { connectStripeTestAccount, disconnectStripe } from "@/lib/stores/actions";

describe("Stripe test account (D-034)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "s1", slug: "maya" });
    storeQueries.setStoreStripeAccount.mockResolvedValue(true);
  });

  it("connects the test account to the session owner's own store", async () => {
    stripe.testSellerAccountId.mockReturnValue("acct_test123");
    expect(await connectStripeTestAccount()).toEqual({ ok: true, data: { connected: true } });
    expect(storeQueries.setStoreStripeAccount).toHaveBeenCalledWith(userId, "acct_test123");
  });

  it("refuses when there is no test account (for example a live key)", async () => {
    stripe.testSellerAccountId.mockReturnValue(null);
    expect(await connectStripeTestAccount()).toMatchObject({ ok: false });
    expect(storeQueries.setStoreStripeAccount).not.toHaveBeenCalled();
  });

  it("disconnects only the owner's store and hides database errors", async () => {
    expect(await disconnectStripe()).toEqual({ ok: true, data: { connected: false } });
    expect(storeQueries.setStoreStripeAccount).toHaveBeenCalledWith(userId, null);
    storeQueries.setStoreStripeAccount.mockRejectedValue(new Error("db down"));
    expect(JSON.stringify(await disconnectStripe())).not.toContain("db down");
  });
});
