import { describe, expect, it } from "vitest";

import { emailCodeSchema, emailSchema, signupInput } from "@/lib/auth/schemas";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Maya@Example.COM ")).toBe("maya@example.com");
  });

  it.each(["", "maya", "maya@", "@example.com", `${"a".repeat(250)}@example.com`])("rejects %s", (input) => {
    expect(emailSchema.safeParse(input).success).toBe(false);
  });
});

describe("emailCodeSchema", () => {
  it("accepts 6 digits and ignores spaces", () => {
    expect(emailCodeSchema.parse("123456")).toBe("123456");
    expect(emailCodeSchema.parse(" 123 456 ")).toBe("123456");
  });

  it.each(["12345", "1234567", "12a456", "", "١٢٣٤٥٦"])("rejects %s", (input) => {
    expect(emailCodeSchema.safeParse(input).success).toBe(false);
  });
});

describe("signupInput", () => {
  const valid = { username: "Maya-Books", fullName: "  Maya Patel ", email: " Maya@Example.com ", phone: "+1 415 555 0100" };

  it("cleans and accepts a complete form", () => {
    expect(signupInput.parse(valid)).toEqual({
      username: "maya-books",
      fullName: "Maya Patel",
      email: "maya@example.com",
      phone: "+14155550100",
    });
  });

  it("makes the phone number optional", () => {
    expect(signupInput.parse({ ...valid, phone: "" }).phone).toBeUndefined();
  });

  it("reports problems in form order, with the field name", () => {
    const result = signupInput.safeParse({ username: "ab", fullName: "", email: "nope", phone: "1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["username", "fullName", "email", "phone"]);
  });

  it.each([
    ["empty name", { fullName: "   " }, "Enter your full name."],
    ["name over 80 characters", { fullName: "x".repeat(81) }, "Use 80 characters or fewer."],
    ["name with a control character", { fullName: "Maya\u0007" }, "Remove the special characters from your name."],
    ["reserved username", { username: "admin" }, "That username is taken. Try another."],
    ["bad phone", { phone: "415" }, "Check the number and the country code."],
  ])("rejects %s", (_label, override, message) => {
    const result = signupInput.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
