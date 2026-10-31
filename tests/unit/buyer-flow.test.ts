import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeAPIError, authApi, formData, library, rateLimit, redirectOf, storeQueries } from "./auth-mocks";

const hoisted = vi.hoisted(() => ({
  tokens: new Map<string, { _id: string; orderId: string; email: string; name: string; expiresAt: Date; usedAt: Date | null }>(),
  outbox: new Map<string, { status: string }>(),
  order: { current: null as unknown },
  sendEmail: vi.fn(),
  ctx: {
    findUserByEmail: vi.fn(),
    findAccounts: vi.fn(),
    createUser: vi.fn(),
    linkAccount: vi.fn(),
    hash: vi.fn(async (value: string) => `hashed:${value}`),
  },
  saveProfile: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000" } }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => error instanceof Error && error.message === "dup" }));
vi.mock("@/lib/db/collections", () => ({
  collections: vi.fn(async () => ({
    accessTokens: {
      insertOne: vi.fn(async (doc: { _id: string }) => void hoisted.tokens.set(doc._id, doc as never)),
      findOne: vi.fn(async ({ _id }: { _id: string }) => hoisted.tokens.get(_id) ?? null),
      updateOne: vi.fn(async (filter: { _id: string; usedAt?: null }, update: { $set: { usedAt: Date | null } }) => {
        const doc = hoisted.tokens.get(filter._id);
        if (!doc || (filter.usedAt === null && doc.usedAt !== null)) return { matchedCount: 0 };
        doc.usedAt = update.$set.usedAt;
        return { matchedCount: 1 };
      }),
    },
    orders: { findOne: vi.fn(async () => hoisted.order.current) },
    products: { findOne: vi.fn(async () => ({ afterPurchase: { emailSubject: "Your {{product_title}} is ready", emailBody: null } })) },
    stores: { findOne: vi.fn(async () => ({ name: "Maya's Kitchen" })) },
    emailOutbox: {
      insertOne: vi.fn(async (doc: { _id: string; status: string }) => {
        if (hoisted.outbox.has(doc._id)) throw new Error("dup");
        hoisted.outbox.set(doc._id, { status: doc.status });
      }),
      updateOne: vi.fn(async (filter: { _id: string; status?: string }, update: { $set: { status?: string } }) => {
        const row = hoisted.outbox.get(filter._id);
        if (!row || (filter.status && row.status !== filter.status)) return { matchedCount: 0 };
        if (update.$set.status) row.status = update.$set.status;
        return { matchedCount: 1 };
      }),
    },
  })),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: hoisted.sendEmail }));
vi.mock("@/lib/auth/profiles", () => ({ saveProfile: hoisted.saveProfile, getProfile: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => void) => void fn() }));

import { signInWithPassword } from "@/lib/auth/actions";
import { consumeAccessToken, createAccessToken, hashToken, lookupAccessToken, releaseAccessToken } from "@/lib/auth/access-tokens";
import { createBuyerPassword } from "@/lib/auth/buyer-account";
import { createPasswordFromLink } from "@/lib/auth/buyer-actions";
import { passwordInput } from "@/lib/auth/password-schemas";
import { escapeHtml, fillVariables, renderOrderEmail } from "@/lib/email/templates";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { auth } from "@/lib/auth/auth";

const order = { _id: "o1", status: "paid", buyerEmail: "maya@example.com", buyerName: "Maya Patel", productId: "p1", storeId: "s1", item: { title: "Playbook" } };
const ORDER_ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.tokens.clear();
  hoisted.outbox.clear();
  hoisted.order.current = order;
  hoisted.ctx.findUserByEmail.mockResolvedValue(null);
  hoisted.ctx.findAccounts.mockResolvedValue([]);
  hoisted.ctx.createUser.mockResolvedValue({ id: "user-1" });
  hoisted.ctx.linkAccount.mockResolvedValue({});
  rateLimit.takeRateLimit.mockResolvedValue(true);
  // The shared auth mock has no $context, so it is attached here for the buyer password code.
  (auth as unknown as { $context: unknown }).$context = Promise.resolve({ password: { hash: hoisted.ctx.hash }, internalAdapter: hoisted.ctx });
});

describe("order email template (D-014)", () => {
  const vars = { customerName: "Maya", productTitle: "Playbook", accessLink: "https://pickstall.store/welcome/abc" };

  it("fills only the three variables and keeps the store name and the link", () => {
    const email = renderOrderEmail({ storeName: "Maya's Kitchen", vars, subject: "Hi {{customer_name}}: {{product_title}}", body: "Hello {{customer_name}} {{secret}}" });
    expect(email.subject).toBe("Hi Maya: Playbook");
    expect(email.text).toContain("Hello Maya {{secret}}");
    expect(email.text).toContain(vars.accessLink);
    expect(email.text).toContain("Maya's Kitchen");
    expect(email.html).toContain(`href="${vars.accessLink}"`);
  });

  it("does not repeat the link when the creator's message already has it", () => {
    const email = renderOrderEmail({ storeName: "S", vars, subject: null, body: "Get it: {{download_link}}" });
    expect(email.text.split(vars.accessLink)).toHaveLength(2);
  });

  it("escapes HTML and removes line breaks from the subject, so a name cannot inject markup or headers", () => {
    const email = renderOrderEmail({ storeName: "<b>S</b>", vars: { ...vars, customerName: '<img src=x onerror="1">\r\nBcc: x@y.z' }, subject: "{{customer_name}}", body: null });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;b&gt;S&lt;/b&gt;");
    expect(escapeHtml(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
    expect(fillVariables("{{ download_link }}", vars)).toBe(vars.accessLink);
  });
});

describe("access tokens", () => {
  it("stores only the hash and reports valid, used and invalid states", async () => {
    const token = await createAccessToken({ orderId: "o1", email: " Maya@Example.com ", name: "Maya" });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hoisted.tokens.has(token)).toBe(false);
    expect(hoisted.tokens.get(hashToken(token))?.email).toBe("maya@example.com");

    expect((await lookupAccessToken(token)).status).toBe("valid");
    expect(await consumeAccessToken(token)).toBe(true);
    expect(await consumeAccessToken(token)).toBe(false);
    expect((await lookupAccessToken(token)).status).toBe("used");
    await releaseAccessToken(token);
    expect((await lookupAccessToken(token)).status).toBe("valid");
    expect((await lookupAccessToken("short")).status).toBe("invalid");
    expect((await lookupAccessToken("a".repeat(43))).status).toBe("invalid");
  });

  it("expires after the link period", async () => {
    const token = await createAccessToken({ orderId: "o1", email: "maya@example.com", name: "Maya" }, new Date("2026-01-01T00:00:00Z"));
    expect((await lookupAccessToken(token, new Date("2026-03-01T00:00:00Z"))).status).toBe("expired");
  });
});

describe("createBuyerPassword", () => {
  it("creates a verified user with a hashed credential and a profile", async () => {
    expect(await createBuyerPassword({ email: " Maya@Example.com ", name: "Maya", password: "correct horse" })).toEqual({ ok: true, userId: "user-1" });
    expect(hoisted.ctx.createUser).toHaveBeenCalledWith({ email: "maya@example.com", name: "Maya", emailVerified: true }, { method: "email-password" });
    expect(hoisted.ctx.linkAccount).toHaveBeenCalledWith({ userId: "user-1", providerId: "credential", accountId: "user-1", password: "hashed:correct horse" });
  });

  it("adds a password to an existing user without one, and never replaces an existing password", async () => {
    hoisted.ctx.findUserByEmail.mockResolvedValue({ user: { id: "user-9" } });
    expect((await createBuyerPassword({ email: "maya@example.com", name: "Maya", password: "correct horse" })).ok).toBe(true);
    expect(hoisted.ctx.createUser).not.toHaveBeenCalled();
    hoisted.ctx.linkAccount.mockClear();
    hoisted.ctx.findAccounts.mockResolvedValue([{ providerId: "credential" }]);
    expect(await createBuyerPassword({ email: "maya@example.com", name: "Maya", password: "another one" })).toEqual({ ok: false, reason: "has_password" });
    expect(hoisted.ctx.linkAccount).not.toHaveBeenCalled();
  });
});

describe("password rules", () => {
  it("needs 8 to 128 characters and a matching confirmation", () => {
    expect(passwordInput.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(passwordInput.safeParse({ password: "long enough", confirm: "different" }).success).toBe(false);
    expect(passwordInput.safeParse({ password: "x".repeat(129), confirm: "x".repeat(129) }).success).toBe(false);
    expect(passwordInput.safeParse({ password: "long enough", confirm: "long enough" }).success).toBe(true);
  });
});

describe("createPasswordFromLink", () => {
  const form = (password = "correct horse", confirm = password) => formData({ password, confirm });
  const makeToken = () => createAccessToken({ orderId: ORDER_ID, email: "maya@example.com", name: "Maya" });

  it("uses the link up, saves the password, signs the buyer in and opens the purchase", async () => {
    const token = await makeToken();
    authApi.signInEmail.mockResolvedValue({ user: { id: "user-1" } });
    expect(await redirectOf(() => createPasswordFromLink(token, null, form()))).toBe(`/library/${ORDER_ID}`);
    expect(authApi.signInEmail).toHaveBeenCalledWith(expect.objectContaining({ body: { email: "maya@example.com", password: "correct horse" } }));
    expect((await lookupAccessToken(token)).status).toBe("used");
  });

  it("rejects a weak or mismatched password without using the link", async () => {
    const token = await makeToken();
    expect(await createPasswordFromLink(token, null, form("short"))).toMatchObject({ ok: false, field: "password" });
    expect(await createPasswordFromLink(token, null, form("correct horse", "nope nope nope"))).toMatchObject({ ok: false, field: "confirm" });
    expect((await lookupAccessToken(token)).status).toBe("valid");
  });

  it("refuses an unknown, used or over-tried link", async () => {
    expect(await createPasswordFromLink("a".repeat(43), null, form())).toMatchObject({ ok: false });
    const token = await makeToken();
    await consumeAccessToken(token);
    expect(await createPasswordFromLink(token, null, form())).toMatchObject({ ok: false });
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await createPasswordFromLink(await makeToken(), null, form())).toMatchObject({ ok: false });
  });

  it("gives the link back when saving fails, and never changes an account that already has a password", async () => {
    const token = await makeToken();
    hoisted.ctx.createUser.mockRejectedValueOnce(new Error("db down"));
    const result = await createPasswordFromLink(token, null, form());
    expect(JSON.stringify(result)).not.toContain("db down");
    expect((await lookupAccessToken(token)).status).toBe("valid");

    hoisted.ctx.findUserByEmail.mockResolvedValue({ user: { id: "user-9" } });
    hoisted.ctx.findAccounts.mockResolvedValue([{ providerId: "credential" }]);
    expect(await redirectOf(() => createPasswordFromLink(token, null, form()))).toContain("/login?next=");
    expect(hoisted.ctx.linkAccount).not.toHaveBeenCalled();
    expect((await lookupAccessToken(token)).status).toBe("valid");
  });
});

describe("signInWithPassword", () => {
  const login = (extra: Record<string, string> = {}) => formData({ email: "Maya@Example.com", password: "correct horse", ...extra });

  it("signs in and sends a buyer to the library", async () => {
    authApi.signInEmail.mockResolvedValue({ user: { id: "user-1", email: "maya@example.com" } });
    storeQueries.findStoreByOwner.mockResolvedValue(null);
    library.hasPurchases.mockResolvedValue(true);
    expect(await redirectOf(() => signInWithPassword(null, login()))).toBe("/library");
    expect(authApi.signInEmail).toHaveBeenCalledWith(expect.objectContaining({ body: { email: "maya@example.com", password: "correct horse" } }));
  });

  it("follows a safe next path and ignores an unsafe one", async () => {
    authApi.signInEmail.mockResolvedValue({ user: { id: "user-1", email: "maya@example.com" } });
    expect(await redirectOf(() => signInWithPassword(null, login({ next: "/library/abc" })))).toBe("/library/abc");
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "s1" });
    library.hasPurchases.mockResolvedValue(false);
    expect(await redirectOf(() => signInWithPassword(null, login({ next: "https://evil.example.com" })))).toBe("/dashboard");
  });

  it("gives the same answer for a wrong password and an unknown email, and never leaks details", async () => {
    authApi.signInEmail.mockRejectedValue(new FakeAPIError(401, "INVALID_EMAIL_OR_PASSWORD"));
    const wrong = await signInWithPassword(null, login());
    authApi.signInEmail.mockRejectedValue(new FakeAPIError(404, "USER_NOT_FOUND"));
    const unknown = await signInWithPassword(null, login({ email: "nobody@example.com" }));
    expect(wrong).toEqual({ ok: false, error: "Email or password is incorrect." });
    expect(unknown).toEqual(wrong);
  });

  it("is rate limited and validates input first", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await signInWithPassword(null, login())).toMatchObject({ ok: false });
    expect(authApi.signInEmail).not.toHaveBeenCalled();
    rateLimit.takeRateLimit.mockResolvedValue(true);
    expect(await signInWithPassword(null, login({ email: "nope" }))).toMatchObject({ ok: false, field: "email" });
  });
});

describe("sendOrderConfirmation", () => {
  it("emails the buyer once with a link that opens the welcome page, and not again on a replay", async () => {
    hoisted.sendEmail.mockResolvedValue(undefined);
    expect(await sendOrderConfirmation("o1")).toBe("sent");
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
    const sent = hoisted.sendEmail.mock.calls[0]?.[0] as { to: string; subject: string; text: string };
    expect(sent.to).toBe("maya@example.com");
    expect(sent.subject).toBe("Your Playbook is ready");
    expect(sent.text).toMatch(/http:\/\/localhost:3000\/welcome\/[A-Za-z0-9_-]{43}/);
    expect(await sendOrderConfirmation("o1")).toBe("skipped");
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed send as failed and tries again next time", async () => {
    hoisted.sendEmail.mockRejectedValueOnce(new Error("resend down"));
    expect(await sendOrderConfirmation("o1")).toBe("failed");
    expect(hoisted.outbox.get("o1:order-confirmation")?.status).toBe("failed");
    hoisted.sendEmail.mockResolvedValue(undefined);
    expect(await sendOrderConfirmation("o1")).toBe("sent");
  });

  it("does nothing for an order that is not paid", async () => {
    hoisted.order.current = null;
    expect(await sendOrderConfirmation("o1")).toBe("skipped");
    expect(hoisted.sendEmail).not.toHaveBeenCalled();
  });
});
