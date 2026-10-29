import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CUSTOM_FONT_SIZES, cn } from "@/lib/utils";

describe("cn with design tokens", () => {
  it("keeps a custom text size next to a text color", () => {
    expect(cn("text-button text-primary-foreground")).toBe("text-button text-primary-foreground");
    expect(cn("text-h3 text-ink")).toBe("text-h3 text-ink");
  });

  it("still lets a later text size or color win over an earlier one", () => {
    expect(cn("text-h3 text-h4")).toBe("text-h4");
    expect(cn("text-base text-h1")).toBe("text-h1");
    expect(cn("text-ink text-mute")).toBe("text-mute");
  });

  it("does not confuse text alignment, size and color", () => {
    expect(cn("text-center text-h3 text-ink")).toBe("text-center text-h3 text-ink");
  });

  it("merges hard shadows with each other but not with colors", () => {
    expect(cn("shadow-hard-sm shadow-hard-md")).toBe("shadow-hard-md");
    expect(cn("shadow-hard-sm text-ink")).toBe("shadow-hard-sm text-ink");
  });

  it("registers every custom text size defined in globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const defined = [...css.matchAll(/--text-([a-z0-9]+(?:-[a-z0-9]+)*):/g)].map((match) => match[1] as string);
    const builtIn = new Set(["xs", "sm", "base"]);
    const custom = [...new Set(defined)].filter((name) => !builtIn.has(name));
    expect(custom.sort()).toEqual([...CUSTOM_FONT_SIZES].sort());
  });

  it("never gives a text size the name of a color (text-input would turn into a color)", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const colors = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1] as string));
    expect(CUSTOM_FONT_SIZES.filter((size) => colors.has(size))).toEqual([]);
  });
});
