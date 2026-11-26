import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AA_LARGE_OR_UI, AA_TEXT, contrastRatio } from "@/lib/contrast";

// Reads styles/tokens.css itself, so the tests always check the real token values.

const css = readFileSync("styles/tokens.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Returns the text between the braces of the first block that starts with `selector`. */
function blockBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Block not found: ${selector}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed block: ${selector}`);
}

function declarations(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1] as string] = (match[2] as string).trim();
  }
  return result;
}

const light = declarations(blockBody(css, ":root"));
const darkOverrides = declarations(blockBody(css, ':root[data-theme="dark"]'));
const darkFromMedia = declarations(
  blockBody(blockBody(css, "@media (prefers-color-scheme: dark)"), ':root:not([data-theme="light"])'),
);
const dark = { ...light, ...darkOverrides };

const HEX = /^#[0-9a-f]{6}$/i;
const COLOR_TOKENS = [
  "bg", "bg-subtle", "surface", "ink", "mute", "line", "border-input", "border-strong",
  "blue", "on-blue", "blue-hover", "blue-active", "blue-soft",
  "yellow", "on-yellow", "yellow-soft", "mint", "mint-soft",
  "danger", "on-danger", "danger-soft", "warning", "warning-soft",
];

describe("tokens.css structure", () => {
  it("defines every color token as a 6-digit hex in light mode", () => {
    for (const name of COLOR_TOKENS) expect(light[name], name).toMatch(HEX);
  });

  it("defines every color token as a 6-digit hex in dark mode", () => {
    for (const name of COLOR_TOKENS) expect(dark[name], name).toMatch(HEX);
  });

  it("keeps the OS dark block and the data-theme dark block identical", () => {
    expect(darkFromMedia).toEqual(darkOverrides);
  });

  it("only overrides tokens in dark mode that exist in light mode", () => {
    for (const name of Object.keys(darkOverrides)) expect(light, name).toHaveProperty(name);
  });

  it("uses a white page background in light mode (white theme, D-007)", () => {
    expect(light["bg"]).toBe("#ffffff");
  });

  it("uses the radii from DESIGN.md section 6", () => {
    expect([light["radius-sm"], light["radius-md"], light["radius-lg"]]).toEqual(["8px", "12px", "16px"]);
  });

  it("uses the popover shadow from DESIGN.md section 6", () => {
    expect(light["shadow-popover"]).toBe("0 8px 24px rgb(11 13 42 / 0.12)");
  });
});

type Mode = "light" | "dark";
const modes: Record<Mode, Record<string, string>> = { light, dark };

/** [foreground token, background token, minimum ratio, documented ratio from DESIGN.md 3.1 or null] */
const PAIRS: Record<Mode, [string, string, number, number | null][]> = {
  light: [
    ["ink", "bg", AA_TEXT, 19.0],
    ["ink", "bg-subtle", AA_TEXT, 17.9],
    ["ink", "surface", AA_TEXT, null],
    ["mute", "bg", AA_TEXT, 6.2],
    ["mute", "surface", AA_TEXT, null],
    ["mute", "bg-subtle", AA_TEXT, 5.8],
    ["blue", "bg-subtle", AA_TEXT, 5.2],
    ["blue", "blue-soft", AA_TEXT, 4.8],
    ["border-input", "bg-subtle", AA_LARGE_OR_UI, 3.7],
    ["on-blue", "blue", AA_TEXT, 5.6],
    ["on-blue", "blue-hover", AA_TEXT, 7.2],
    ["on-blue", "blue-active", AA_TEXT, 9.2],
    ["blue", "bg", AA_TEXT, 5.6],
    ["blue", "surface", AA_TEXT, null],
    ["ink", "blue-soft", AA_TEXT, null],
    ["mute", "blue-soft", AA_TEXT, null],
    ["on-yellow", "yellow", AA_TEXT, 11.9],
    ["ink", "yellow-soft", AA_TEXT, null],
    ["mint", "surface", AA_TEXT, 5.4],
    ["mint", "bg", AA_TEXT, 5.4],
    ["mint", "mint-soft", AA_TEXT, 4.8],
    ["danger", "surface", AA_TEXT, 5.9],
    ["danger", "danger-soft", AA_TEXT, 5.1],
    ["on-danger", "danger", AA_TEXT, null],
    ["warning", "surface", AA_TEXT, 5.9],
    ["warning", "warning-soft", AA_TEXT, 5.4],
    ["warning", "yellow-soft", AA_TEXT, 5.5],
    ["border-input", "bg", AA_LARGE_OR_UI, 3.9],
    ["border-input", "surface", AA_LARGE_OR_UI, 3.9],
    ["border-strong", "bg", AA_LARGE_OR_UI, null],
    ["border-strong", "surface", AA_LARGE_OR_UI, null],
  ],
  dark: [
    ["ink", "bg", AA_TEXT, 17.1],
    ["ink", "surface", AA_TEXT, null],
    ["mute", "bg", AA_TEXT, null],
    ["mute", "surface", AA_TEXT, 7.3],
    ["on-blue", "blue", AA_TEXT, 6.2],
    ["on-blue", "blue-hover", AA_TEXT, null],
    ["on-blue", "blue-active", AA_TEXT, null],
    ["blue", "bg", AA_TEXT, null],
    ["blue", "surface", AA_TEXT, null],
    ["ink", "blue-soft", AA_TEXT, null],
    ["mute", "blue-soft", AA_TEXT, null],
    ["on-yellow", "yellow", AA_TEXT, 11.9],
    ["ink", "yellow-soft", AA_TEXT, null],
    ["mint", "surface", AA_TEXT, 9.2],
    ["mint", "bg", AA_TEXT, null],
    ["mint", "mint-soft", AA_TEXT, null],
    ["danger", "surface", AA_TEXT, null],
    ["danger", "danger-soft", AA_TEXT, null],
    ["on-danger", "danger", AA_TEXT, null],
    ["warning", "surface", AA_TEXT, null],
    ["warning", "warning-soft", AA_TEXT, null],
    ["border-input", "bg", AA_LARGE_OR_UI, 3.6],
    ["border-input", "surface", AA_LARGE_OR_UI, 3.2],
    ["border-strong", "bg", AA_LARGE_OR_UI, 4.5],
    ["border-strong", "surface", AA_LARGE_OR_UI, 4.0],
  ],
};

describe.each(["light", "dark"] as const)("contrast in %s mode", (mode) => {
  it.each(PAIRS[mode])("%s on %s passes its WCAG minimum", (fg, bg, minimum) => {
    const ratio = contrastRatio(modes[mode][fg] as string, modes[mode][bg] as string);
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });

  it("matches the measured ratios documented in DESIGN.md section 3.1", () => {
    for (const [fg, bg, , documented] of PAIRS[mode]) {
      if (documented === null) continue;
      const ratio = contrastRatio(modes[mode][fg] as string, modes[mode][bg] as string);
      expect(Math.abs(ratio - documented), `${fg} on ${bg}: ${ratio.toFixed(2)} vs ${documented}`).toBeLessThanOrEqual(0.06);
    }
  });
});

describe("no raw colors outside the token files", () => {
  // Email HTML cannot use CSS variables, so its inline colors live in lib/email/templates.ts (D-037).
  // lib/brand-colors.ts: the social platforms' official colors for their logos (D-046).
  const ALLOWED = new Set([path.normalize("styles/tokens.css"), path.normalize("lib/themes.ts"), path.normalize("lib/email/templates.ts"), path.normalize("lib/email/looks.ts"), path.normalize("lib/store-templates/catalog.ts"), path.normalize("lib/brand-colors.ts")]);
  const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(tsx?|css)$/.test(entry) ? [full] : [];
    });
  }

  it("keeps hex/rgb/hsl/oklch literals in tokens.css and themes.ts only", () => {
    const offenders = ["app", "components", "lib", "styles"]
      .flatMap(sourceFiles)
      .filter((file) => !ALLOWED.has(path.normalize(file)))
      .filter((file) => RAW_COLOR.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
    expect(offenders).toEqual([]);
  });
});
