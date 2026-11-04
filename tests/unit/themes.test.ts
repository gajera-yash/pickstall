import { describe, expect, it } from "vitest";

import { AA_TEXT, contrastRatio } from "@/lib/contrast";
import { DEFAULT_THEME, THEME_PRESET_IDS, THEME_PRESETS } from "@/lib/themes";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2F3BFF", "#2f3bff")).toBeCloseTo(1, 5);
  });

  it("is symmetric and accepts 3-digit hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(contrastRatio("#000000", "#FFFFFF"), 5);
  });

  it("rejects non-hex input", () => {
    expect(() => contrastRatio("blue", "#FFFFFF")).toThrow(/Not a hex color/);
    expect(() => contrastRatio("#12345", "#FFFFFF")).toThrow(/Not a hex color/);
  });
});

describe("storefront theme presets (DESIGN.md section 11)", () => {
  it("has the presets, keyed by id (the first three keep their order for existing stores)", () => {
    expect([...THEME_PRESET_IDS]).toEqual(["clean", "bold", "soft", "studio", "academy"]);
    for (const id of THEME_PRESET_IDS) expect(THEME_PRESETS[id].id).toBe(id);
  });

  it.each(THEME_PRESET_IDS)("%s: every text pair passes 4.5:1", (id) => {
    const t = THEME_PRESETS[id];
    expect(contrastRatio(t.text, t.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(t.muted, t.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(t.text, t.card)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(t.muted, t.card)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("matches the measured ratios documented in DESIGN.md section 11", () => {
    const near = (actual: number, documented: number) => Math.abs(actual - documented) <= 0.06;
    const { bold, soft, clean } = THEME_PRESETS;
    expect(near(contrastRatio(bold.onAccent, bold.accent), 13.7)).toBe(true);
    expect(near(contrastRatio(soft.onAccent, soft.accent), 5.2)).toBe(true);
    expect(near(contrastRatio(soft.text, soft.background), 15.1)).toBe(true);
    expect(near(contrastRatio(clean.muted, clean.background), 6.2)).toBe(true);
  });

  it("defaults to the Clean preset with its own accent", () => {
    expect(DEFAULT_THEME).toEqual({ preset: "clean", accent: "#0056FF" });
  });
});
