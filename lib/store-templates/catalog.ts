import type { PageBlock } from "@/lib/page-blocks/rules";
import { EMPTY_DESIGN, type StoreDesign } from "@/lib/store-design/rules";
import type { ThemePresetId } from "@/lib/themes";

// Store templates (D-130): ready-made looks a creator can start from in one click. A template is
// only a theme, an accent, a custom design (D-123) and optional sample sections (D-101), so it is
// saved through the same checked paths as a design made by hand; tests run every template through
// those rules (valid options, readable contrast, valid sections). Sample text is a starting point
// the creator edits; products always come from the store itself.

export type StoreTemplate = {
  id: string;
  name: string;
  description: string;
  /** Who it suits, shown as a small label. */
  bestFor: string;
  preset: ThemePresetId;
  accent: string;
  design: StoreDesign;
  /** Sample sections around the products; always contains the one products marker. */
  blocks: PageBlock[];
};

const design = (change: Partial<StoreDesign>): StoreDesign => ({ ...EMPTY_DESIGN, ...change, button: { ...EMPTY_DESIGN.button, ...change.button }, header: { ...EMPTY_DESIGN.header, ...change.header } });
const products = (id: string): PageBlock => ({ id: `${id}-products`, type: "products" });

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: "coach",
    name: "Coach",
    description: "Calm and trustworthy, with a short intro, your offer and a client quote.",
    bestFor: "Coaches and consultants",
    preset: "clean",
    accent: "#1D4ED8",
    design: design({ font: "serif", headingWeight: 600, button: { shape: "pill", style: "filled" }, radius: 16, header: { align: "center", cover: null, showSocial: true } }),
    blocks: [
      { id: "coach-intro", type: "text", heading: "Hi, I'm here to help you grow", body: "I help people like you get unstuck and move forward with a clear plan. Pick a session or a guide below to get started." },
      products("coach"),
      { id: "coach-quote", type: "testimonial", quote: "After three sessions I finally had a plan I could stick to.", name: "A happy client" },
    ],
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Bold and energetic, made to stop the scroll.",
    bestFor: "Trainers and athletes",
    preset: "bold",
    accent: "#0B0D2A",
    design: design({ font: "grotesk", headingWeight: 800, button: { shape: "square", style: "filled" }, radius: 4, border: "thick", shadow: "hard" }),
    blocks: [
      { id: "fit-intro", type: "text", heading: "Train smarter. Get stronger.", body: "Programs, meal plans and coaching to help you hit your goals, at home or in the gym.", style: { box: "none", align: "center", spacing: "normal" } },
      products("fit"),
      { id: "fit-quote", type: "testimonial", quote: "Down 8 kg in 12 weeks and stronger than ever.", name: "Program member" },
    ],
  },
  {
    id: "course-creator",
    name: "Course creator",
    description: "A clean catalog that puts your courses first.",
    bestFor: "Teachers and course creators",
    preset: "academy",
    accent: "#4F46E5",
    design: design({ button: { shape: "rounded", style: "filled" }, header: { align: "left", cover: null, showSocial: true } }),
    blocks: [
      { id: "course-intro", type: "text", heading: "Learn at your own pace", body: "Clear, practical courses with lifetime access. Start with the one that fits where you are today." },
      products("course"),
      { id: "course-quote", type: "testimonial", quote: "The clearest course I've taken. I used it at work the next day.", name: "Student" },
    ],
  },
  {
    id: "artist",
    name: "Artist",
    description: "Warm and editorial, like a gallery page.",
    bestFor: "Artists, designers and photographers",
    preset: "editorial",
    accent: "#7A4E24",
    design: design({ font: "playfair", headingWeight: 600, button: { shape: "square", style: "filled" }, radius: 0, border: "thin" }),
    blocks: [
      { id: "art-intro", type: "text", heading: "Prints, presets and resources", body: "Everything I make, in one place. Thank you for supporting independent work.", style: { box: "none", align: "center", spacing: "roomy" } },
      products("art"),
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "White, quiet and simple. Your products do the talking.",
    bestFor: "Anyone who likes it simple",
    preset: "clean",
    accent: "#111827",
    design: design({ colors: { background: "#FFFFFF", text: "#111827", muted: "#4B5563", card: "#FFFFFF" }, border: "thin", shadow: "none", radius: 8, button: { shape: "rounded", style: "filled" }, productView: "list" }),
    blocks: [products("min")],
  },
  {
    id: "creator",
    name: "Creator",
    description: "Dark and neon for a bold personal brand.",
    bestFor: "Influencers and content creators",
    preset: "neon",
    accent: "#22D3EE",
    design: design({ font: "poppins", headingWeight: 800, button: { shape: "pill", style: "filled" } }),
    blocks: [
      { id: "creator-links", type: "links", links: [{ label: "Watch my latest video", url: "https://www.youtube.com/" }] },
      products("creator"),
    ],
  },
  {
    id: "wellness",
    name: "Wellness",
    description: "Soft, warm and friendly, with round corners.",
    bestFor: "Yoga, wellness and lifestyle",
    preset: "soft",
    accent: "#C2410C",
    design: design({ font: "serif", headingWeight: 600, button: { shape: "pill", style: "filled" }, radius: 24, header: { align: "center", cover: null, showSocial: true } }),
    blocks: [
      { id: "well-intro", type: "text", heading: "Feel better, one day at a time", body: "Gentle guides and programs to help you slow down, breathe and build habits that last.", style: { box: "none", align: "center", spacing: "normal" } },
      products("well"),
      { id: "well-quote", type: "testimonial", quote: "My mornings feel completely different now.", name: "Community member" },
    ],
  },
  {
    id: "writer",
    name: "Writer",
    description: "Classic and readable, with a serif headline.",
    bestFor: "Writers, newsletters and ebooks",
    preset: "studio",
    accent: "#2F5D50",
    design: design({ font: "serif", headingWeight: 600, button: { shape: "rounded", style: "filled" }, layout: "stack", productView: "list" }),
    blocks: [
      { id: "writer-intro", type: "text", heading: "Stories and guides worth reading", body: "Ebooks, templates and the newsletter I've been writing for years. Start with a free sample." },
      products("writer"),
    ],
  },
];

export function findTemplate(id: string): StoreTemplate | null {
  return STORE_TEMPLATES.find((template) => template.id === id) ?? null;
}
