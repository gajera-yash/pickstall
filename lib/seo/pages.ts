import { STAN } from "@/components/landing/content";
import { APP_NAME, TRIAL_DAYS } from "@/lib/config";
import { PRICES } from "@/lib/seo/site-facts";

// Content of the comparison and use-case pages (D-134). Honesty rules: facts about other platforms
// come only from their own public pages, with the source and the date checked shown on the page; no
// claim about what they lack beyond what those pages say; each page also says when the other option
// may suit a creator better. Re-check before changing any number.

export type CompareRow = { topic: string; pickstall: string; other: string };
export type ComparePage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  lead: string;
  rows: CompareRow[];
  /** Where the other platform's facts come from, and when they were checked. */
  source: { label: string; url: string; checkedOn: string };
  whyPickstall: string[];
  whenOther: string[];
};

const usd = (value: number) => `$${value}`;

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "stan-store",
    name: STAN.name,
    title: `${APP_NAME} vs Stan Store`,
    description: `Compare ${APP_NAME} and Stan Store: plans, fees and features for selling digital products, courses and coaching from a link-in-bio store.`,
    lead: `${APP_NAME} and Stan Store are both link-in-bio stores for creators. ${APP_NAME} costs less: ${usd(PRICES.starter)} and ${usd(PRICES.pro)} a month against Stan Store's ${usd(STAN.creatorCents / 100)} and ${usd(STAN.creatorProCents / 100)}, with 0% transaction fees.`,
    rows: [
      { topic: "Monthly plans", pickstall: `Starter ${usd(PRICES.starter)}, Pro ${usd(PRICES.pro)}`, other: `Creator ${usd(STAN.creatorCents / 100)}, Creator Pro ${usd(STAN.creatorProCents / 100)}` },
      { topic: "Free period", pickstall: `${TRIAL_DAYS}-day free trial with Pro features, no card`, other: "Not stated on the pages we checked" },
      { topic: "Platform fee on sales", pickstall: "0% (PayPal processing fees apply)", other: "Not stated on the pages we checked" },
      { topic: "Digital products and courses", pickstall: "Yes, on every plan", other: "Yes (Creator plan)" },
      { topic: "Coaching calls with booking", pickstall: "Yes (Pro)", other: "Yes (Creator plan)" },
      { topic: "Coupons and order bumps", pickstall: "Yes, on every plan", other: "Creator Pro" },
      { topic: "Upsells, funnels and email automations", pickstall: "Yes (Pro)", other: "Creator Pro" },
      { topic: "Memberships", pickstall: "Coming soon", other: "Yes (Creator plan)" },
    ],
    source: { label: "Stan Store help center (Creator vs Creator Pro)", url: "https://help.stan.store", checkedOn: STAN.checkedOn },
    whyPickstall: [
      `Lower monthly price on both plans, and 0% transaction fees.`,
      "Coupons, order bumps, pixels and affiliate tracking are on the cheaper plan.",
      "Store templates, custom design and a live preview, plus quizzes and certificates for courses.",
    ],
    whenOther: ["You need memberships today: Stan Store has them; on Pickstall they are coming soon.", "You want a platform that has been around longer and has a large creator community."],
  },
  {
    slug: "gumroad",
    name: "Gumroad",
    title: `${APP_NAME} vs Gumroad`,
    description: `Compare ${APP_NAME} and Gumroad: a fixed monthly plan with 0% transaction fees, or a fee on every sale.`,
    lead: `Gumroad charges no monthly fee but takes 10% + $0.50 of every direct sale (30% through its Discover marketplace). ${APP_NAME} is a fixed monthly plan from ${usd(PRICES.starter)} with 0% transaction fees, so the more you sell, the more you keep.`,
    rows: [
      { topic: "Pricing model", pickstall: `Monthly plan: ${usd(PRICES.starter)} or ${usd(PRICES.pro)}`, other: "No monthly fee" },
      { topic: "Fee on each sale", pickstall: "0% (PayPal processing fees apply)", other: "10% + $0.50 on direct sales, 30% via Discover" },
      { topic: "Sales tax and VAT", pickstall: "You handle it (you are the seller of record)", other: "Gumroad is the merchant of record and handles it" },
      { topic: "Digital products and courses", pickstall: "Yes", other: "Yes" },
      { topic: "Coaching calls with booking", pickstall: "Yes (Pro)", other: "Not stated on the page we checked" },
      { topic: "Mobile link-in-bio storefront", pickstall: "Yes, with themes and templates", other: "Profile page" },
    ],
    source: { label: "Gumroad pricing page", url: "https://gumroad.com/pricing", checkedOn: "November 26, 2026" },
    whyPickstall: [
      `On $1,000 of monthly sales, a 10% fee is over $100; ${APP_NAME} Starter is ${usd(PRICES.starter)}.`,
      "A storefront made for your bio link, with coaching calls, upsells and email tools built in.",
      "Money goes straight to your own PayPal account.",
    ],
    whenOther: ["You sell only a little each month: no monthly fee can cost less.", "You want the platform to handle sales tax and VAT for you as merchant of record.", "You want buyers to find you through a marketplace (Gumroad Discover)."],
  },
  {
    slug: "linktree",
    name: "Linktree",
    title: `${APP_NAME} vs Linktree`,
    description: `Compare ${APP_NAME} and Linktree for creators who want to sell digital products, courses and coaching from their bio link.`,
    lead: `Linktree is a link-in-bio page that lists your links; selling ("commerce") is part of its Premium plan. ${APP_NAME} is built for selling: every plan is a full store for digital products, courses and coaching, with checkout, delivery and 0% transaction fees.`,
    rows: [
      { topic: "Main purpose", pickstall: "A store that sells from your bio link", other: "A page of links (with commerce on Premium)" },
      { topic: "Plans", pickstall: `Starter ${usd(PRICES.starter)}, Pro ${usd(PRICES.pro)} a month`, other: "Free, Starter, Pro, Premium (prices vary by region)" },
      { topic: "Platform fee on sales", pickstall: "0% (PayPal processing fees apply)", other: "Not stated on the page we checked" },
      { topic: "Courses with video, quizzes and certificates", pickstall: "Yes", other: "Not stated on the page we checked" },
      { topic: "Coaching calls with booking", pickstall: "Yes (Pro)", other: "Not stated on the page we checked" },
      { topic: "Email list, broadcasts and automations", pickstall: "Yes", other: "Marketing integrations (Premium)" },
    ],
    source: { label: "Linktree pricing page", url: "https://linktr.ee/s/pricing", checkedOn: "November 26, 2026" },
    whyPickstall: ["Selling is the point: products, checkout, delivery and a buyer library on every plan.", "Courses, coaching calls, coupons, upsells and email tools in one place.", "0% transaction fees; buyers pay into your own PayPal account."],
    whenOther: ["You mainly need a free page of links and don't sell yet: Linktree has a free plan.", "You already sell elsewhere and only want to point to those links."],
  },
];

export type UseCasePage = { slug: string; who: string; title: string; description: string; lead: string; sells: string[]; tools: string[] };

export const USE_CASE_PAGES: UseCasePage[] = [
  {
    slug: "coaches",
    who: "Coaches and consultants",
    title: `${APP_NAME} for coaches`,
    description: `Sell 1:1 coaching calls, guides and programs from your bio link with ${APP_NAME}: booking, payments and reminders in one place, 0% transaction fees.`,
    lead: `Coaches use ${APP_NAME} to sell 1:1 calls and digital programs from one link. Clients pick a time, pay, and get a calendar invite and reminders; you keep 100% of the price, minus PayPal's fees.`,
    sells: ["1:1 coaching calls with a booking calendar", "Workbooks, guides and templates", "Online programs as courses with video", "A free guide that grows your email list"],
    tools: ["Call reminders 24 hours and 1 hour before", "Checkout questions (up to 5) to prepare each session", "Upsell a program after a call", "Review requests after a purchase"],
  },
  {
    slug: "fitness",
    who: "Fitness trainers and athletes",
    title: `${APP_NAME} for fitness creators`,
    description: `Sell workout programs, meal plans and coaching from your bio link with ${APP_NAME}. Video courses, 0% transaction fees, made for phones.`,
    lead: `Fitness creators use ${APP_NAME} to sell training programs, meal plans and coaching from the link in their Instagram or TikTok bio. Buyers pay in a few taps on their phone and get instant access.`,
    sells: ["Workout programs as video courses", "Meal plans and trackers as downloads", "1:1 coaching or form-check calls", "A free starter plan to collect emails"],
    tools: ["Drip lessons week by week", "Order bumps (for example a meal plan with a program)", "Coupons for challenges and launches", "A bold Fitness store template"],
  },
  {
    slug: "course-creators",
    who: "Course creators and teachers",
    title: `${APP_NAME} for course creators`,
    description: `Sell online courses with video, quizzes and certificates from your bio link with ${APP_NAME}. Plans from $${PRICES.starter} a month, 0% transaction fees.`,
    lead: `Course creators use ${APP_NAME} to host and sell online courses: video lessons, quizzes, certificates and drip release, sold from one link with 0% transaction fees.`,
    sells: ["Video courses with modules and lessons", "Quizzes and certificates of completion", "Templates and resources as downloads", "Live coaching calls as an add-on"],
    tools: ["Lessons that open on a schedule (drip)", "Student progress and a buyer library", "Upsells and downsells after purchase", "Affiliate links with commissions"],
  },
];

export function findCompare(slug: string): ComparePage | null {
  return COMPARE_PAGES.find((page) => page.slug === slug) ?? null;
}

export function findUseCase(slug: string): UseCasePage | null {
  return USE_CASE_PAGES.find((page) => page.slug === slug) ?? null;
}
