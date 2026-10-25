import { createCn } from "cn/config";

/**
 * Custom type-scale names from app/globals.css (text-button, text-h3, ...). Without this list the
 * class merger mistakes them for text colors and silently drops one of two conflicting classes
 * (for example text-button next to text-primary-foreground). tests/unit/utils.test.ts fails if
 * globals.css gets a text size that is missing here.
 */
export const CUSTOM_FONT_SIZES = [
  "button",
  "h4",
  "h3",
  "h2",
  "h1",
  "display-l",
  "display-xl",
  "body-l",
  "money-m",
  "money-l",
] as const;

/** Class merger: clsx + conflict resolution, taught about this project's design tokens. */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: [...CUSTOM_FONT_SIZES] }],
      shadow: [{ shadow: ["hard-sm", "hard-md", "hard-lg", "overlay"] }],
    },
  },
});
