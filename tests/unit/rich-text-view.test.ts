import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichTextView } from "@/components/store/rich-text";
import type { RichDoc } from "@/lib/products/rich-text";

const render = (doc: RichDoc) => renderToStaticMarkup(createElement(RichTextView, { doc }));

describe("RichTextView (D-049)", () => {
  it("renders the allowed structure as elements", () => {
    const html = render({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Inside" }] },
        { type: "paragraph", content: [{ type: "text", text: "Bold", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "next" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] }] },
      ],
    });
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<br/>");
    expect(html).toContain("<ul");
  });

  it("escapes text, so nothing a creator types becomes markup", () => {
    const html = render({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: '<img src=x onerror="alert(1)">' }] }] });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("opens links safely and drops unsafe ones even if they slipped past validation", () => {
    const link = (href: string) =>
      render({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "go", marks: [{ type: "link", attrs: { href } }] }] }] });
    expect(link("https://example.com")).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(link("https://example.com")).toContain('target="_blank"');
    expect(link("javascript:alert(1)")).not.toContain("<a");
  });
});
