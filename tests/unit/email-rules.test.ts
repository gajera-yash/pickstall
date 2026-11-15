import { describe, expect, it } from "vitest";

import { canonicalEmail, isDisposableEmail } from "@/lib/auth/email-rules";

describe("canonicalEmail", () => {
  it("folds Gmail dots, +tags and googlemail.com into one inbox", () => {
    const one = canonicalEmail("maya@gmail.com");
    expect(canonicalEmail("m.aya@gmail.com")).toBe(one);
    expect(canonicalEmail("Maya+shop2@Gmail.com")).toBe(one);
    expect(canonicalEmail("m.a.y.a+x@googlemail.com")).toBe(one);
    expect(one).toBe("maya@gmail.com");
  });

  it("removes +tags on other providers but keeps their dots", () => {
    expect(canonicalEmail("jo.doe+test@outlook.com")).toBe("jo.doe@outlook.com");
    expect(canonicalEmail("jo.doe@outlook.com")).not.toBe(canonicalEmail("jodoe@outlook.com"));
  });

  it("keeps different people apart", () => {
    expect(canonicalEmail("maya@gmail.com")).not.toBe(canonicalEmail("maya2@gmail.com"));
    expect(canonicalEmail("maya@yahoo.com")).not.toBe(canonicalEmail("maya@gmail.com"));
  });

  it("rejects things that are not emails", () => {
    expect(canonicalEmail("nope")).toBeNull();
    expect(canonicalEmail("@gmail.com")).toBeNull();
    expect(canonicalEmail("+tag@gmail.com")).toBeNull();
  });
});

describe("isDisposableEmail", () => {
  it("catches throwaway domains and their subdomains", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@YOPMAIL.com")).toBe(true);
    expect(isDisposableEmail("x@inbox.guerrillamail.com")).toBe(true);
  });

  it("lets normal providers through", () => {
    expect(isDisposableEmail("x@gmail.com")).toBe(false);
    expect(isDisposableEmail("x@mailinator.com.example.org")).toBe(false);
    expect(isDisposableEmail("x@company.in")).toBe(false);
  });
});
