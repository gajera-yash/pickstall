// Guided tours, page tours and "New" hotspots for creators (D-128). Pure and client-safe. A step
// points at an element by its `data-tour` attribute; a step whose element is not on the page (a
// phone layout, an empty list) is skipped. Text is short: one idea per step.

export type TourStep = { target: string; title: string; body: string };
export type TourDefinition = { id: TourId; steps: TourStep[] };

export const TOUR_IDS = ["welcome", "store-design", "product-editor", "marketing", "orders", "analytics"] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** Features that get a "New" dot until the creator opens or dismisses them. */
export const HOTSPOT_IDS = ["new-email-design", "new-review-request", "new-affiliates", "new-funnels", "new-store-design"] as const;
export type HotspotId = (typeof HOTSPOT_IDS)[number];

/** Everything a creator can have seen: tours and hotspots. */
export const SEEN_IDS: readonly string[] = [...TOUR_IDS, ...HOTSPOT_IDS];

export const TOURS: Record<TourId, TourStep[]> = {
  welcome: [
    { target: "nav-store", title: "Welcome to Pickstall 👋", body: "This is My Store: your sales at a glance, your products and a live preview of your page." },
    { target: "nav-design", title: "Make it yours", body: "Store design is where you pick a theme, colors, fonts and the sections on your page." },
    { target: "nav-products", title: "Add what you sell", body: "Digital downloads, courses, coaching calls and free lead magnets all live in Products." },
    { target: "nav-orders", title: "Every sale, in one place", body: "Orders shows each purchase, the buyer's answers and refunds. Customers groups them by person." },
    { target: "nav-marketing", title: "Sell more", body: "Coupons, emails, abandoned cart, reviews, affiliates and funnels are in Marketing." },
    { target: "nav-settings", title: "Get paid", body: "Connect payments in Settings so buyers can pay you directly. Pickstall takes 0% of your sales." },
  ],
  "store-design": [
    { target: "design-tabs", title: "Three steps to your look", body: "Theme picks a starting point, Customize changes colors, fonts and buttons, Sections adds content around your products." },
    { target: "design-preview", title: "See it live", body: "Every change shows here first. Switch between Phone and Desktop, and scroll inside to see the whole page." },
    { target: "design-save", title: "Save when you're happy", body: "One Save button publishes all your changes. Until then, only you see them." },
  ],
  "product-editor": [
    { target: "product-steps", title: "Fill in the steps", body: "Go through each step: details, checkout and publish. You can come back to any step later." },
    { target: "product-save", title: "Save as you go", body: "Your product stays a draft, hidden from your store, until you publish it." },
  ],
  marketing: [
    { target: "marketing-coupons", title: "Discount codes", body: "Create a code like SAVE20 and share it. Buyers enter it at checkout." },
    { target: "marketing-email-design", title: "Your emails, your look", body: "Pick one design for every email you send, in your store's colors." },
    { target: "marketing-tools", title: "More ways to grow", body: "Broadcasts, affiliates, funnels and your email list each have their own page." },
  ],
  orders: [
    { target: "orders-filters", title: "Find any order", body: "Filter by status or product, or search by name and email." },
    { target: "orders-export", title: "Take your data", body: "Download your orders as a CSV for your accounting." },
  ],
  analytics: [
    { target: "analytics-sources", title: "Where sales come from", body: "Add ?utm_source=instagram to the links you share, and this table tells you which ones sell." },
  ],
};

export const HOTSPOTS: Record<HotspotId, { title: string; body: string }> = {
  "new-email-design": { title: "New: email designs", body: "Give every email the same look, in your colors. Pick one of four designs." },
  "new-review-request": { title: "New: review requests", body: "One friendly email a week after each purchase asks buyers to rate your product." },
  "new-affiliates": { title: "New: affiliates", body: "Give people their own link and a commission on the sales they bring." },
  "new-funnels": { title: "New: funnels", body: "See how many buyers take your upsell and downsell offers." },
  "new-store-design": { title: "New: Store design", body: "Customize colors, fonts, buttons and layout on its own page, with a big live preview." },
};

export function isSeenId(value: unknown): value is string {
  return typeof value === "string" && SEEN_IDS.includes(value);
}
