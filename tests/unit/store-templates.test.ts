import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/store/fonts", () => ({ storeSerif: { variable: "" }, STORE_FONTS: {} }));

// D-130: every store template passes the same rules as a design made by hand.

import { pageBlocksInput, videosOf } from "@/lib/page-blocks/rules";
import { designContrastProblem, designToForm, storeDesignInput } from "@/lib/store-design/rules";
import { STORE_TEMPLATES, findTemplate } from "@/lib/store-templates/catalog";
import { accentSchema } from "@/lib/stores/schemas";
import { THEME_PRESETS } from "@/lib/themes";
import { watchUrlFor } from "@/lib/courses/video-links";

describe("store templates", () => {
  it("has 8 templates with unique ids", () => {
    expect(STORE_TEMPLATES).toHaveLength(8);
    expect(new Set(STORE_TEMPLATES.map((template) => template.id)).size).toBe(8);
    expect(findTemplate("coach")?.name).toBe("Coach");
    expect(findTemplate("nope")).toBeNull();
  });

  it.each(STORE_TEMPLATES.map((template) => [template.id, template] as const))("%s: accent, design and sections are all valid and readable", (_id, template) => {
    expect(accentSchema.safeParse(template.accent).success).toBe(true);
    const parsed = storeDesignInput.safeParse(designToForm(template.design));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(template.design);
      expect(designContrastProblem(THEME_PRESETS[template.preset], template.accent, parsed.data)).toBeNull();
    }
    // Sections go through the editor's own rules (videos as links, as the editor sends them).
    const asSent = template.blocks.map((block) => (block.type === "video" ? { id: block.id, type: "video", links: videosOf(block).map(watchUrlFor) } : block));
    const blocks = pageBlocksInput.safeParse(asSent);
    expect(blocks.success).toBe(true);
  });
});

describe("template picker", () => {
  it("lists every template with its own button, and offers the sample sections", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { TemplatePicker } = await import("@/components/dashboard/template-picker");
    const html = renderToStaticMarkup(createElement(TemplatePicker, { hasSections: false, onApply: () => {}, onUndo: () => {}, canUndo: false }));
    for (const template of STORE_TEMPLATES) expect(html).toContain(`Use the ${template.name} template`);
    expect(html).toContain("Also use the template&#x27;s sample sections");
  });
});
