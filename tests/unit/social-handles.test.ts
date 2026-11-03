import { describe, expect, it } from "vitest";

import { checkSocialValue, displayValueFor, handleFromUrl, normalizeHandle } from "@/lib/stores/social-handles";

const ok = (url: string) => ({ ok: true, url });

describe("social usernames (D-046)", () => {
  it("builds each platform's profile link from a username", () => {
    expect(checkSocialValue("instagram", "maya.cooks")).toEqual(ok("https://www.instagram.com/maya.cooks"));
    expect(checkSocialValue("tiktok", "maya_cooks")).toEqual(ok("https://www.tiktok.com/@maya_cooks"));
    expect(checkSocialValue("facebook", "maya.cooks")).toEqual(ok("https://www.facebook.com/maya.cooks"));
    expect(checkSocialValue("x", "maya_cooks")).toEqual(ok("https://x.com/maya_cooks"));
    expect(checkSocialValue("linkedin", "maya-patel-1")).toEqual(ok("https://www.linkedin.com/in/maya-patel-1"));
    expect(checkSocialValue("youtube", "maya.cooks")).toEqual(ok("https://www.youtube.com/@maya.cooks"));
  });

  it("treats an empty row as no link", () => {
    expect(checkSocialValue("instagram", "  ")).toBeNull();
  });

  it("drops a leading @ and reads a pasted profile link back to its username", () => {
    expect(normalizeHandle("x", "@maya")).toBe("maya");
    expect(normalizeHandle("instagram", "https://www.instagram.com/maya.cooks/?hl=en")).toBe("maya.cooks");
    expect(normalizeHandle("instagram", "instagram.com/maya")).toBe("maya");
    expect(normalizeHandle("youtube", "https://youtube.com/@maya")).toBe("maya");
    expect(normalizeHandle("x", "https://twitter.com/maya")).toBe("maya");
    expect(normalizeHandle("linkedin", "linkedin.com/in/maya-patel")).toBe("maya-patel");
  });

  it.each([
    ["x", "far_too_long_handle"],
    ["x", "maya-cooks"],
    ["facebook", "maya"],
    ["facebook", "maya_cooks"],
    ["youtube", "ab"],
    ["youtube", ".maya"],
    ["youtube", "maya."],
    ["linkedin", "ab"],
    ["linkedin", "maya patel"],
    ["instagram", "maya cooks"],
    ["instagram", "maya/../admin"],
    ["tiktok", "<script>"],
  ] as const)("refuses %s %j", (kind, value) => {
    expect(checkSocialValue(kind, value)).toMatchObject({ ok: false });
  });

  it("accepts YouTube handles in other scripts, as YouTube allows", () => {
    expect(checkSocialValue("youtube", "料理")).toEqual(ok(`https://www.youtube.com/@${encodeURIComponent("料理")}`));
  });

  it("does not read a link on another site as a username", () => {
    expect(handleFromUrl("instagram", "https://evil.example/maya")).toBeNull();
    expect(checkSocialValue("instagram", "https://evil.example/maya")).toMatchObject({ ok: false });
  });

  it("checks email and website rows", () => {
    expect(checkSocialValue("email", " Maya@Example.com ")).toEqual(ok("mailto:maya@example.com"));
    expect(checkSocialValue("email", "maya@")).toMatchObject({ ok: false });
    expect(checkSocialValue("website", "https://maya.com")).toEqual(ok("https://maya.com"));
    expect(checkSocialValue("website", "http://maya.com")).toMatchObject({ ok: false });
    expect(checkSocialValue("website", "javascript:alert(1)")).toMatchObject({ ok: false });
  });

  it("shows saved links back in the form as usernames", () => {
    expect(displayValueFor("tiktok", "https://www.tiktok.com/@maya")).toBe("maya");
    expect(displayValueFor("email", "mailto:maya@example.com")).toBe("maya@example.com");
    expect(displayValueFor("website", "https://maya.com")).toBe("https://maya.com");
    // An old link we cannot read stays as it was, so nothing is lost silently.
    expect(displayValueFor("instagram", "https://instagr.am/maya")).toBe("https://instagr.am/maya");
  });
});
