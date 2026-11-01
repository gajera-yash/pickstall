// Copy for the marketing landing (D-039). Honesty rules: Phase 1 sells digital products; anything
// else is tagged "Coming soon"; every 0% claim sits near the card-processing note (DESIGN.md 15).

export const LANDING_NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
] as const;

export const CARD_FEES_NOTE = "Stripe's card processing fees still apply.";

export const STEPS = [
  { title: "Claim your link", body: "Pick a username. Your stall lives at one short link you can put in any bio." },
  { title: "Make it yours", body: "Photo, bio, social links, a theme and your own accent color. No code, no designer." },
  { title: "Add what you sell", body: "Guides, templates, presets, workbooks. Set a price or let buyers pay what they want." },
  { title: "Connect payments and share", body: "Buyers pay into your own Stripe account. You see every order, customer and dollar." },
] as const;

export const COMING_SOON = [
  "Courses with video",
  "Coupons",
  "Order bumps",
  "File uploads",
  "Email marketing",
  "Custom domain",
  "Memberships",
  "Bookings",
  "Affiliates",
] as const;

export const FAQ = [
  {
    q: "What does 0% transaction fees mean?",
    a: "We never take a percentage of your sales. Buyers pay into your own Stripe account. Stripe's card processing fees still apply, as they do everywhere.",
  },
  {
    q: "What does it cost?",
    a: "Founding creators get the first 6 months free. After that it is one flat monthly plan with 0% transaction fees. You will see the price before anyone is asked to pay.",
  },
  {
    q: "Do I need to code or design?",
    a: "No. You fill in your details, pick a theme and add products. Your stall works on every phone out of the box.",
  },
  {
    q: "How do I get paid?",
    a: "You connect your own Stripe account. Money goes straight to it; Pickstall never holds or forwards your funds.",
  },
  {
    q: "Who handles taxes?",
    a: "You do, as the seller. Pickstall is not a merchant of record and does not collect or file sales tax or VAT for you.",
  },
  {
    q: "What can I sell today?",
    a: "Digital products: guides, templates, presets, workbooks and more, at a fixed price or pay what you want. Courses, coupons and order bumps are coming soon.",
  },
  {
    q: "How do my buyers get their purchase?",
    a: "After a verified payment they get an email with a private link and a library where they can open their purchases any time.",
  },
  {
    q: "Which countries?",
    a: "We start with creators selling to buyers in the US, UK and Canada. Creators elsewhere can join where Stripe supports them.",
  },
] as const;
