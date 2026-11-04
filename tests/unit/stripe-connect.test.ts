import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectFlow as flow, mockSession, rateLimit, storeQueries, stripeConnect as connect, testAccount as stripe, userId } from "./auth-mocks";

import { connectStripeTestAccount, disconnectStripe, startStripeConnect } from "@/lib/stores/actions";

describe("Stripe Connect actions (D-034, D-053)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "s1", slug: "maya" });
    storeQueries.setStoreStripeConnection.mockResolvedValue({ previousAccountId: null });
    rateLimit.takeRateLimit.mockResolvedValue(true);
    connect.connectAvailable.mockReturnValue(true);
  });

  it("starts OAuth with a state bound to the session user", async () => {
    expect(await startStripeConnect("setup")).toEqual({ ok: true, data: { url: "https://connect.stripe.com/oauth/authorize?state=abc" } });
    expect(flow.createConnectState).toHaveBeenCalledWith(userId, "setup");
    expect(connect.connectAuthorizeUrl).toHaveBeenCalledWith({ state: "state-abc", redirectUri: "http://localhost:3000/api/connect/stripe/callback", email: "maya@example.com" });
  });

  it("refuses an unknown return target, a server without Connect and too many attempts", async () => {
    expect(await startStripeConnect("https://evil.example" as never)).toMatchObject({ ok: false });
    connect.connectAvailable.mockReturnValue(false);
    expect(await startStripeConnect("settings")).toMatchObject({ ok: false });
    connect.connectAvailable.mockReturnValue(true);
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await startStripeConnect("settings")).toMatchObject({ ok: false });
    expect(flow.createConnectState).not.toHaveBeenCalled();
  });

  it("connects the test account to the session owner's own store", async () => {
    stripe.testSellerAccountId.mockReturnValue("acct_test123");
    expect(await connectStripeTestAccount()).toEqual({ ok: true, data: { connected: true } });
    expect(storeQueries.setStoreStripeConnection).toHaveBeenCalledWith(userId, expect.objectContaining({ accountId: "acct_test123", livemode: false }));
  });

  it("refuses the test account when there is none (for example a live key)", async () => {
    stripe.testSellerAccountId.mockReturnValue(null);
    expect(await connectStripeTestAccount()).toMatchObject({ ok: false });
    expect(storeQueries.setStoreStripeConnection).not.toHaveBeenCalled();
  });

  it("disconnects only the owner's store, releases the old account and hides database errors", async () => {
    storeQueries.setStoreStripeConnection.mockResolvedValue({ previousAccountId: "acct_old" });
    expect(await disconnectStripe()).toEqual({ ok: true, data: { connected: false } });
    expect(storeQueries.setStoreStripeConnection).toHaveBeenCalledWith(userId, null);
    expect(flow.releaseAccount).toHaveBeenCalledWith(userId, "acct_old");
    storeQueries.setStoreStripeConnection.mockRejectedValue(new Error("db down"));
    expect(JSON.stringify(await disconnectStripe())).not.toContain("db down");
  });
});
