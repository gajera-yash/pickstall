import { describe, expect, it } from "vitest";

import { scrubEvent, scrubUrl } from "@/lib/monitoring/scrub";

// Error reports must never carry tokens, order ids, cookies, headers or form bodies (D-075).

describe("scrubUrl", () => {
  it("drops the query string and the fragment", () => {
    expect(scrubUrl("https://pickstall.store/login?next=/dashboard&email=a@b.c#top")).toBe("https://pickstall.store/login");
  });

  it("replaces the order-email token and order ids", () => {
    expect(scrubUrl("/welcome/abcDEF123-secret_token")).toBe("/welcome/[token]");
    expect(scrubUrl("/library/0b9a7a52-58d4-4c1e-9a43-2f5f1e0b1c11/lesson")).toBe("/library/[orderId]/lesson");
    expect(scrubUrl("https://x.test/mock-pay/0B9A7A52-58D4-4C1E-9A43-2F5F1E0B1C11?x=1")).toBe("https://x.test/mock-pay/[orderId]");
  });

  it("leaves ordinary paths alone", () => {
    expect(scrubUrl("/dashboard/settings/plan")).toBe("/dashboard/settings/plan");
    expect(scrubUrl("/@maya/course")).toBe("/@maya/course");
  });
});

describe("scrubEvent", () => {
  it("removes request details and the user, and scrubs URLs everywhere", () => {
    const event = {
      request: { url: "https://x.test/welcome/tok?email=a@b.c", query_string: "email=a@b.c", cookies: { session: "s" }, headers: { cookie: "s" }, data: { otp: "123456" } },
      transaction: "/welcome/tok",
      user: { email: "a@b.c", ip_address: "1.2.3.4" },
      breadcrumbs: [{ data: { url: "/library/0b9a7a52-58d4-4c1e-9a43-2f5f1e0b1c11?t=1", from: "/welcome/x", to: "/a?b=c", status: 200 } }, {}],
    };
    const result = scrubEvent(event);
    expect(result).toBe(event);
    expect(result.request).toEqual({ url: "https://x.test/welcome/[token]" });
    expect(result.transaction).toBe("/welcome/[token]");
    expect(result).not.toHaveProperty("user");
    expect(result.breadcrumbs[0]?.data).toEqual({ url: "/library/[orderId]", from: "/welcome/[token]", to: "/a", status: 200 });
  });

  it("handles an event without a request", () => {
    expect(scrubEvent({ transaction: "/dashboard?x=1" })).toEqual({ transaction: "/dashboard" });
  });
});
