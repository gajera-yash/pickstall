import { describe, expect, it, vi } from "vitest";

// NoSQL injection (PRD 5.5 item 5): a server action or route can be called with any JSON, so every
// value that reaches a MongoDB filter must be a plain string of the expected shape. Operator objects
// ({ $ne: null }), arrays and dotted keys must never get through.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({})) }));
vi.mock("@/lib/env.server", () => ({ serverEnv: {} }));

import { isTokenShape } from "@/lib/auth/access-tokens";
import { passwordLoginInput } from "@/lib/auth/password-schemas";
import { sendCodeInput, verifyCodeInput } from "@/lib/auth/schemas";
import { isUuid } from "@/lib/media/media";
import { parseOrderParams } from "@/lib/orders/params";
import { buyerInput } from "@/lib/orders/schemas";
import { productIdInput, productStatusInput } from "@/lib/products/schemas";

const uuid = "0b9e8d2c-1111-4222-8333-444455556666";
const token = "A".repeat(43);
const operators: unknown[] = [{ $ne: null }, { $gt: "" }, { $regex: ".*" }, { $where: "1" }, [uuid], [token], null, 1, true];

describe("id and token checks accept only strings of the right shape", () => {
  it.each(operators)("isUuid rejects %j", (value) => {
    expect(isUuid(value as string)).toBe(false);
  });

  it.each(operators)("isTokenShape rejects %j", (value) => {
    expect(isTokenShape(value as string)).toBe(false);
  });

  it.each(operators)("productIdInput rejects %j", (value) => {
    expect(productIdInput.safeParse(value).success).toBe(false);
  });

  it("still accepts the real thing", () => {
    expect(isUuid(uuid)).toBe(true);
    expect(isTokenShape(token)).toBe(true);
    expect(productIdInput.safeParse(uuid).success).toBe(true);
  });

  it("rejects ids with extra text around them", () => {
    expect(isUuid(`${uuid}\n`)).toBe(false);
    expect(isUuid(` ${uuid}`)).toBe(false);
  });
});

describe("form schemas reject operator objects where strings are expected", () => {
  it.each(operators.filter((value) => typeof value === "object" && value !== null))("email %j", (value) => {
    expect(sendCodeInput.safeParse({ email: value }).success).toBe(false);
    expect(verifyCodeInput.safeParse({ email: value, code: "123456" }).success).toBe(false);
    expect(passwordLoginInput.safeParse({ email: value, password: "secret-pass" }).success).toBe(false);
    expect(buyerInput.safeParse({ name: "Maya", email: value, phone: "" }).success).toBe(false);
  });

  it("rejects an operator object as a password or a status", () => {
    expect(passwordLoginInput.safeParse({ email: "a@b.co", password: { $ne: "" } }).success).toBe(false);
    expect(productStatusInput.safeParse({ $ne: "draft" }).success).toBe(false);
  });

  it("drops unknown keys, so `$`-keys and dotted keys never reach an update", () => {
    const parsed = buyerInput.parse({ name: "Maya", email: "maya@example.com", phone: "", $set: { status: "paid" }, "item.priceCents": 0 });
    expect(Object.keys(parsed).some((key) => key.startsWith("$") || key.includes("."))).toBe(false);
  });
});

describe("order list query string", () => {
  it("ignores operator-looking values and keeps only known filters", () => {
    expect(parseOrderParams({ status: "$ne", q: undefined, before: "[object Object]" })).toEqual({});
    expect(parseOrderParams({ status: ["paid", "refunded"], q: "  maya  " })).toEqual({ status: "paid", q: "maya" });
  });
});
