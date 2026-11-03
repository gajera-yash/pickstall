import { describe, expect, it } from "vitest";

import { docFromPlainText, isEmptyDoc, plainTextOf, richDocSchema, safeHref } from "@/lib/products/rich-text";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown[]) => (marks ? { type: "text", text: value, marks } : { type: "text", text: value });

describe("rich text descriptions (D-049)", () => {
  it("keeps the allowed nodes and marks", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("What you get")] },
      p(text("Bold", [{ type: "bold" }]), text(" and "), text("link", [{ type: "link", attrs: { href: "https://example.com/a" } }])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("One"))] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [p(text("Two", [{ type: "italic" }, { type: "underline" }]))] }] },
    );
    const parsed = richDocSchema.parse(input);
    expect(plainTextOf(parsed)).toBe("What you get\nBold and link\nOne\nTwo");
  });

  it("drops link attributes other than the address", () => {
    const parsed = richDocSchema.parse(doc(p(text("x", [{ type: "link", attrs: { href: "https://example.com", target: "_self", onclick: "alert(1)", class: "evil" } }]))));
    const mark = (parsed.content[0] as { content: { marks: unknown[] }[] }).content[0]?.marks[0];
    expect(mark).toEqual({ type: "link", attrs: { href: "https://example.com/" } });
  });

  it("removes tags from text instead of keeping HTML", () => {
    const parsed = richDocSchema.parse(doc(p(text("Hi <script>alert(1)</script><b>there</b>"))));
    expect(plainTextOf(parsed)).toBe("Hi alert(1)there");
  });

  it.each([
    ["an unknown node", doc({ type: "image", attrs: { src: "https://x.example/a.png" } })],
    ["raw html node", doc({ type: "html", content: "<img src=x onerror=alert(1)>" })],
    ["an unknown mark", doc(p(text("x", [{ type: "highlight" }])))],
    ["a javascript link", doc(p(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])))],
    ["an http link", doc(p(text("x", [{ type: "link", attrs: { href: "http://example.com" } }])))],
    ["a data link", doc(p(text("x", [{ type: "link", attrs: { href: "data:text/html,hi" } }])))],
    ["a level 1 heading", doc({ type: "heading", attrs: { level: 1 }, content: [text("Big")] })],
    ["an empty list", doc({ type: "bulletList", content: [] })],
    ["too much text", doc(p(text("x".repeat(2001))))],
    ["something that is not a document", { type: "paragraph" }],
    ["too many nodes", doc(...Array.from({ length: 700 }, () => p(text("a"))))],
  ])("rejects %s", (_label, input) => {
    expect(richDocSchema.safeParse(input).success).toBe(false);
  });

  it("rejects lists nested too deep", () => {
    let node: unknown = p(text("deep"));
    for (let i = 0; i < 6; i++) node = { type: "bulletList", content: [{ type: "listItem", content: [node] }] };
    expect(richDocSchema.safeParse(doc(node)).success).toBe(false);
  });

  it("drops empty paragraphs at the start and end, keeps blank lines in between", () => {
    const parsed = richDocSchema.parse(doc({ type: "paragraph" }, p(text("A")), { type: "paragraph" }, p(text("B")), { type: "paragraph" }, p(text(" "))));
    expect(parsed.content).toHaveLength(3);
    expect(plainTextOf(parsed)).toBe(["A", "", "B"].join("\n"));
  });

  it("allows only https and mailto links", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com/");
    expect(safeHref("mailto:maya@example.com")).toBe("mailto:maya@example.com");
    expect(safeHref("https://user:pass@example.com")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
  });

  it("turns an old plain description into paragraphs, and knows an empty one", () => {
    expect(docFromPlainText("Line one\n\nLine two")).toEqual(doc(p(text("Line one")), { type: "paragraph" }, p(text("Line two"))));
    expect(isEmptyDoc(docFromPlainText(""))).toBe(true);
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc(docFromPlainText("x"))).toBe(false);
  });
});
