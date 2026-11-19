import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  broadcasts: { findOne: vi.fn(), updateOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), insertOne: vi.fn() },
  stores: { findOne: vi.fn() },
  subscribers: { find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), findOneAndUpdate: vi.fn() },
  webhookEvents: { insertOne: vi.fn(), deleteOne: vi.fn() },
}));
const send = vi.hoisted(() => ({ sendListEmails: vi.fn(async () => undefined) }));
const env = vi.hoisted(() => ({ secret: "whsec_test_secret_123456" as string | undefined }));
const verify = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => (error as { code?: number })?.code === 11000 }));
vi.mock("@/lib/email/send", () => send);
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.pickstall.store/" } }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get RESEND_WEBHOOK_SECRET() {
      return env.secret;
    },
    RESEND_API_KEY: "re_test",
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify };
  },
}));

import { listEmailsFor } from "@/lib/broadcasts/delivery";
import { countBroadcastsStartedSince, listBroadcasts, sendNextBatch } from "@/lib/broadcasts/queries";
import { BROADCASTS_PER_DAY, broadcastProblem, listEmailInput, renderListEmail, senderName, unsubscribeHeaders } from "@/lib/broadcasts/rules";
import { handleResendWebhook, listActionFor } from "@/lib/subscribers/resend-webhook";
import { isUnsubscribeToken, unsubscribeByToken, unsubscribeFromWebhook } from "@/lib/subscribers/unsubscribe";
import { sendWelcomeEmail } from "@/lib/subscribers/welcome";

const STORE = "11111111-1111-4111-8111-111111111111";
const SUB = "22222222-2222-4222-8222-222222222222";
const TOKEN = "a".repeat(32);

function cursor(docs: unknown[]) {
  const chain = { sort: vi.fn(() => chain), limit: vi.fn(() => chain), toArray: vi.fn(async () => docs) };
  return chain;
}

const people = (count: number, start = 0) =>
  Array.from({ length: count }, (_, i) => ({ _id: `sub-${String(start + i).padStart(4, "0")}`, email: `p${start + i}@x.co`, name: i % 2 ? null : "Asha", unsubscribeToken: `${"t".repeat(28)}${String(start + i).padStart(4, "0")}` }));

describe("list email rules (D-095)", () => {
  it("cleans tags and allows only {{customer_name}}", () => {
    expect(listEmailInput.safeParse({ subject: "Hi <b>there</b>", body: "Hello {{customer_name}}" })).toMatchObject({ success: true, data: { subject: "Hi there" } });
    expect(listEmailInput.safeParse({ subject: "Hi", body: "Your link: {{download_link}}" }).success).toBe(false);
    expect(listEmailInput.safeParse({ subject: "", body: "x" }).success).toBe(false);
  });

  it("fills the name, escapes the creator's text and always adds the footer with the unsubscribe link", () => {
    const email = renderListEmail({ storeName: "Asha's Studio", subject: "Hi {{customer_name}}", body: "<script>x</script>\n\nSee https://example.com", name: null, unsubscribeUrl: "https://www.pickstall.store/u/abc" });
    expect(email.subject).toBe("Hi there");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain('href="https://example.com"');
    expect(email.html).toContain('href="https://www.pickstall.store/u/abc"');
    expect(email.text).toContain("You get this email because you joined the email list of Asha's Studio.");
    expect(email.text).toContain("Unsubscribe: https://www.pickstall.store/u/abc");
  });

  it("makes header-safe sender names and RFC 8058 headers", () => {
    expect(senderName('Evil" <x@y.z>\r\nBcc: a')).toBe("Evil x@y.z Bcc: a via Pickstall");
    expect(unsubscribeHeaders("https://a.b/api/unsubscribe/t")).toEqual({ "List-Unsubscribe": "<https://a.b/api/unsubscribe/t>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("blocks an empty list, a list over the plan and the daily limit", () => {
    expect(broadcastProblem({ subscribed: 0, startedToday: 0, limit: 1000 })).toMatch(/Nobody/);
    expect(broadcastProblem({ subscribed: 1001, startedToday: 0, limit: 1000 })).toMatch(/Upgrade/);
    expect(broadcastProblem({ subscribed: 10, startedToday: BROADCASTS_PER_DAY, limit: 1000 })).toMatch(/a day/);
    expect(broadcastProblem({ subscribed: 10, startedToday: 0, limit: 1000 })).toBeNull();
  });

  it("never builds an email for someone without an unsubscribe token", () => {
    const list = people(2);
    const emails = listEmailsFor({ storeId: STORE, storeName: "Asha", subject: "S", body: "B", replyTo: "asha@x.co", kind: "broadcast", people: list, tokens: new Map([[list[0]!._id, TOKEN]]) });
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: "p0@x.co", replyTo: "asha@x.co", headers: { "List-Unsubscribe": `<https://www.pickstall.store/api/unsubscribe/${TOKEN}>` } });
    expect(emails[0]!.tags).toEqual([{ name: "kind", value: "broadcast" }, { name: "store_id", value: STORE }, { name: "subscriber_id", value: list[0]!._id }]);
  });
});

describe("sending a broadcast in batches (D-095)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.stores.findOne.mockResolvedValue({ name: "Asha" });
    db.broadcasts.updateOne.mockResolvedValue({});
  });

  it("sends 100 subscribed people of the broadcast's store after the cursor, with an idempotency key, and moves on", async () => {
    db.broadcasts.findOne.mockResolvedValue({ _id: "b1", storeId: STORE, subject: "S", body: "B", replyTo: null, cursor: "sub-0099", status: "sending" });
    db.subscribers.find.mockReturnValue(cursor(people(100, 100)));
    expect(await sendNextBatch("b1")).toEqual({ done: false, sent: 100 });
    expect(db.subscribers.find.mock.calls[0]![0]).toEqual({ storeId: STORE, status: "subscribed", _id: { $gt: "sub-0099" } });
    expect(send.sendListEmails).toHaveBeenCalledWith(expect.any(Array), "broadcast-b1-sub-0099");
    expect(db.broadcasts.updateOne).toHaveBeenCalledWith({ _id: "b1", status: "sending", cursor: "sub-0099" }, { $set: expect.objectContaining({ cursor: "sub-0199" }), $inc: { sentCount: 100 } });
  });

  it("finishes on a short batch", async () => {
    db.broadcasts.findOne.mockResolvedValue({ _id: "b1", storeId: STORE, subject: "S", body: "B", replyTo: null, cursor: null, status: "sending" });
    db.subscribers.find.mockReturnValue(cursor(people(3)));
    expect(await sendNextBatch("b1")).toEqual({ done: true, sent: 3 });
    expect(send.sendListEmails).toHaveBeenCalledWith(expect.any(Array), "broadcast-b1-start");
    expect(db.broadcasts.updateOne.mock.calls[0]![1].$set).toMatchObject({ status: "sent" });
  });

  it("does nothing for a broadcast that is not sending", async () => {
    db.broadcasts.findOne.mockResolvedValue(null);
    expect(await sendNextBatch("b1")).toEqual({ done: true, sent: 0 });
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("lists and counts only the session's store", async () => {
    db.broadcasts.find.mockReturnValue(cursor([]));
    await listBroadcasts("store-b");
    expect(db.broadcasts.find.mock.calls[0]![0]).toEqual({ storeId: "store-b" });
    db.broadcasts.countDocuments.mockResolvedValue(1);
    await countBroadcastsStartedSince("store-b", new Date("2026-11-19T12:00:00Z"));
    expect(db.broadcasts.countDocuments).toHaveBeenCalledWith({ storeId: "store-b", startedAt: { $gte: new Date("2026-11-18T12:00:00Z") } });
  });
});

describe("unsubscribing (D-095)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts only well-formed tokens", async () => {
    expect(isUnsubscribeToken(TOKEN)).toBe(true);
    expect(isUnsubscribeToken("short")).toBe(false);
    expect(await unsubscribeByToken("../../x")).toBe(false);
    expect(db.subscribers.findOne).not.toHaveBeenCalled();
  });

  it("unsubscribes the token's person once, with the reason", async () => {
    db.subscribers.findOne.mockResolvedValue({ _id: SUB, status: "subscribed" });
    db.subscribers.updateOne.mockResolvedValue({});
    expect(await unsubscribeByToken(TOKEN)).toBe(true);
    expect(db.subscribers.updateOne).toHaveBeenCalledWith({ _id: SUB, status: "subscribed" }, { $set: expect.objectContaining({ status: "unsubscribed", unsubscribeReason: "user" }) });
    db.subscribers.findOne.mockResolvedValue({ _id: SUB, status: "unsubscribed" });
    vi.clearAllMocks();
    db.subscribers.findOne.mockResolvedValue({ _id: SUB, status: "unsubscribed" });
    expect(await unsubscribeByToken(TOKEN)).toBe(true);
    expect(db.subscribers.updateOne).not.toHaveBeenCalled();
  });

  it("removes a webhook's person only within the tagged store", async () => {
    db.subscribers.updateOne.mockResolvedValue({ modifiedCount: 1 });
    await unsubscribeFromWebhook(STORE, SUB, "complained");
    expect(db.subscribers.updateOne).toHaveBeenCalledWith({ _id: SUB, storeId: STORE, status: "subscribed" }, expect.anything());
  });
});

describe("the welcome email (D-095)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is sent once: welcomedAt is claimed first", async () => {
    db.stores.findOne.mockResolvedValue({ name: "Asha", welcomeEmail: { enabled: true, subject: "Welcome", body: "Hi {{customer_name}}" } });
    db.subscribers.findOneAndUpdate.mockResolvedValue({ _id: SUB, email: "p@x.co", name: "Pia", unsubscribeToken: TOKEN });
    expect(await sendWelcomeEmail(STORE, SUB)).toBe("sent");
    expect(db.subscribers.findOneAndUpdate).toHaveBeenCalledWith({ _id: SUB, storeId: STORE, status: "subscribed", welcomedAt: { $in: [null] } }, expect.anything(), expect.anything());
    expect(send.sendListEmails).toHaveBeenCalledWith([expect.objectContaining({ to: "p@x.co", subject: "Welcome" })], `welcome-${SUB}`);
    db.subscribers.findOneAndUpdate.mockResolvedValue(null);
    expect(await sendWelcomeEmail(STORE, SUB)).toBe("skipped");
  });

  it("is not sent when it is off", async () => {
    db.stores.findOne.mockResolvedValue({ name: "Asha", welcomeEmail: { enabled: false, subject: "W", body: "B" } });
    expect(await sendWelcomeEmail(STORE, SUB)).toBe("skipped");
    expect(db.subscribers.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("Resend webhook (D-095)", () => {
  const headers = { id: "msg_1", timestamp: "1700000000", signature: "v1,abc" };
  const tags = { kind: "broadcast", store_id: STORE, subscriber_id: SUB };

  beforeEach(() => {
    vi.clearAllMocks();
    env.secret = "whsec_test_secret_123456";
    db.webhookEvents.insertOne.mockResolvedValue({});
    db.subscribers.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("acts on complaints and permanent bounces of list emails only", () => {
    expect(listActionFor({ type: "email.complained", data: { tags } })).toEqual({ storeId: STORE, subscriberId: SUB, reason: "complained" });
    expect(listActionFor({ type: "email.bounced", data: { tags, bounce: { type: "Permanent" } } })).toMatchObject({ reason: "bounced" });
    expect(listActionFor({ type: "email.bounced", data: { tags, bounce: { type: "Transient" } } })).toBeNull();
    expect(listActionFor({ type: "email.complained", data: { tags: { ...tags, kind: "order" } } })).toBeNull();
    expect(listActionFor({ type: "email.complained", data: { tags: { ...tags, store_id: "x" } } })).toBeNull();
  });

  it("refuses without a secret or with a bad signature", async () => {
    env.secret = undefined;
    expect(await handleResendWebhook("{}", headers)).toEqual({ status: 503, body: "Not configured." });
    env.secret = "whsec_test_secret_123456";
    verify.mockImplementation(() => {
      throw new Error("bad");
    });
    expect(await handleResendWebhook("{}", headers)).toEqual({ status: 400, body: "Bad signature." });
    expect(db.webhookEvents.insertOne).not.toHaveBeenCalled();
  });

  it("handles each delivery once", async () => {
    verify.mockReturnValue({ type: "email.complained", data: { tags } });
    expect(await handleResendWebhook("{}", headers)).toEqual({ status: 200, body: "ok" });
    expect(db.webhookEvents.insertOne).toHaveBeenCalledWith(expect.objectContaining({ _id: "resend:msg_1", source: "resend" }));
    expect(db.subscribers.updateOne).toHaveBeenCalledTimes(1);
    db.webhookEvents.insertOne.mockRejectedValue({ code: 11000 });
    expect(await handleResendWebhook("{}", headers)).toEqual({ status: 200, body: "ok" });
    expect(db.subscribers.updateOne).toHaveBeenCalledTimes(1);
  });
});
