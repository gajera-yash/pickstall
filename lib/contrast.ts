// WCAG 2.1 contrast math. Used by the design-token tests and, later, the storefront accent picker.

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`Not a hex color: ${hex}`);
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colors, from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** WCAG AA minimums: 4.5 for normal text, 3 for large text and UI components. */
export const AA_TEXT = 4.5;
export const AA_LARGE_OR_UI = 3;
