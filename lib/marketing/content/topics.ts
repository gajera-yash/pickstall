import { FOUNDING_MONTHS, FOUNDING_SPOTS, PLANNED_PRICE_CENTS, TRIAL_DAYS } from "@/lib/config";
import { COMPETITOR_FACTS } from "@/lib/marketing/ai/facts";
import type { ContentPillar } from "@/lib/marketing/content/rules";

// The topic bank for daily posts (D-136). Each entry is a brief: a headline and 3 to 5 points the
// writer turns into posts (the template uses them as they are). Only facts we can back: features
// that are live (lib/seo/site-facts.ts), our prices from lib/config.ts, competitor prices from
// lib/marketing/ai/facts.ts. No user counts or results here; real numbers come from the database.

export type Topic = { topic: string; headline: string; points: string[] };

const starter = `$${PLANNED_PRICE_CENTS.starter / 100}`;
const pro = `$${PLANNED_PRICE_CENTS.pro / 100}`;
const PAYPAL_LINE = "Pickstall takes 0% of your sales; PayPal's processing fees still apply.";

export const TOPICS: Record<Exclude<ContentPillar, "build">, Topic[]> = {
  tips: [
    {
      topic: "Pricing a first digital product",
      headline: "How to price your first digital product",
      points: [
        "Price the result it gives, not the hours it took to make.",
        "Test one price with your first buyers before you change it.",
        "Offer a small entry product and one deeper product.",
        "Raise the price when buyers say it was worth more.",
      ],
    },
    {
      topic: "Products from content you already have",
      headline: "5 products you can make from content you already have",
      points: [
        "Turn your most-saved post into a short guide.",
        "Bundle the templates or presets you already use.",
        "Record a mini course from your most-asked questions.",
        "Sell a checklist for a task your audience repeats.",
        "Offer 1:1 calls for people who want direct help.",
      ],
    },
    {
      topic: "Lead magnets that grow an email list",
      headline: "A freebie that actually grows your email list",
      points: [
        "Give away one useful checklist, not a whole course.",
        "Ask only for a first name and an email.",
        "Send the freebie by email straight away.",
        "Send one helpful email before you pitch anything.",
      ],
    },
    {
      topic: "Link in bio as a store",
      headline: "Your link in bio should be a store, not a list of links",
      points: [
        "Every extra tap loses some buyers.",
        "Followers can buy without leaving your page.",
        "Products, freebies and calls sit on one page.",
        "You can see which product actually sells.",
      ],
    },
    {
      topic: "Launching to a small audience",
      headline: "How to launch a digital product to a small audience",
      points: [
        "Tell people it is coming a week before.",
        "Share how you are making it in your stories.",
        "Give first buyers a small launch coupon.",
        "Ask your first buyers for honest feedback.",
      ],
    },
    {
      topic: "Sales pages on a phone",
      headline: "Write a sales page that sells on a phone",
      points: [
        "Say the result in the first line.",
        "Show what is inside with short bullets.",
        "Keep the buy button near the top.",
        "Answer the 3 biggest doubts in plain words.",
      ],
    },
    {
      topic: "Order bumps",
      headline: "Order bumps: the easiest extra sale",
      points: [
        "Offer a small add-on right at checkout.",
        "Make it clearly related to the main product.",
        "Keep it cheaper than the main product.",
        "One tick box, no extra page.",
      ],
    },
    {
      topic: "Losing buyers at checkout",
      headline: "Stop losing buyers at checkout",
      points: [
        "Ask only the questions you really need.",
        "Check your checkout on a phone yourself.",
        "Send a reminder when someone leaves their cart.",
        "Show the price clearly before the buy button.",
      ],
    },
    {
      topic: "Selling coaching calls",
      headline: "How to sell your time with 1:1 coaching calls",
      points: [
        "Sell a clear outcome, not just an hour.",
        "Let people pick a slot when they pay.",
        "Send reminders so fewer people miss the call.",
        "Ask a few questions before the call to prepare.",
      ],
    },
    {
      topic: "Upsells that are not pushy",
      headline: "Upsells that help instead of push",
      points: [
        "Offer the next step right after the purchase.",
        "Make it something the buyer will need anyway.",
        "Offer a smaller option if they say no.",
        "Never hide the price or rush the decision.",
      ],
    },
    {
      topic: "What to post when you sell digital products",
      headline: "What to post when you sell digital products",
      points: [
        "Show the problem your product solves.",
        "Share one small free piece of it.",
        "Share results only when they are real.",
        "Remind people where the link is.",
      ],
    },
    {
      topic: "Turning followers into email subscribers",
      headline: "Followers can disappear. Your email list stays.",
      points: [
        "Platforms change what your followers see.",
        "Your email list reaches people directly.",
        "A free download is the easiest way to start one.",
        "Email your list when you launch something new.",
      ],
    },
  ],
  feature: [
    {
      topic: "Courses with video, quizzes and certificates",
      headline: "Sell an online course from your link in bio",
      points: [
        "Upload lessons with video.",
        "Add quizzes to check what students learned.",
        "Students get a certificate when they finish.",
        "It all lives on the same page as your other products.",
      ],
    },
    {
      topic: "1:1 coaching calls with booking",
      headline: "Sell coaching calls with booking built in",
      points: [
        "Buyers pick a time slot when they pay.",
        "Both of you get reminders before the call.",
        "Set your own hours and call length.",
        "No separate booking tool needed.",
      ],
    },
    {
      topic: "Coupons, order bumps, upsells and downsells",
      headline: "Sell more to the buyers you already have",
      points: [
        "Coupons for launches and special days.",
        "Order bumps: a small add-on at checkout.",
        "Upsells and downsells after the purchase.",
        "All included in the plans, no extra apps.",
      ],
    },
    {
      topic: "Email list and automatic emails",
      headline: "Your email list, built into your store",
      points: [
        "Collect emails with free lead magnets.",
        "Send broadcasts to your list.",
        "Abandoned cart emails bring buyers back.",
        "Review emails ask happy buyers for a review.",
      ],
    },
    {
      topic: "Store design: themes and templates",
      headline: "Make your store look like you",
      points: [
        "Pick from 9 themes and 8 ready-made templates.",
        "Change colors, fonts and buttons.",
        "Add page sections in any order.",
        "See every change in a live preview.",
      ],
    },
    {
      topic: "Affiliates and pixels",
      headline: "Know where your sales come from",
      points: [
        "Give partners an affiliate link and track their sales.",
        "Connect your Meta and Google pixels.",
        "See which posts and links bring buyers.",
        "Spend your time on what works.",
      ],
    },
    {
      topic: "Free lead magnets",
      headline: "Give away a freebie, grow your list",
      points: [
        "Offer a free guide or checklist on your store.",
        "Visitors get it by email.",
        "Their email joins your list.",
        "Later, tell them about your paid products.",
      ],
    },
  ],
  fees: [
    {
      topic: "The real cost of a link-in-bio store",
      headline: "What does a link-in-bio store really cost?",
      points: [
        PAYPAL_LINE,
        `Pickstall Starter is ${starter} a month and Pro is ${pro} a month.`,
        `Stan Store's Creator Pro plan is ${COMPETITOR_FACTS.stanCreatorPro} a month.`,
        `Gumroad charges ${COMPETITOR_FACTS.gumroadFee}.`,
      ],
    },
    {
      topic: "Getting paid into your own PayPal",
      headline: "Your sales go straight to your own PayPal",
      points: [
        "Buyers pay into your own PayPal account.",
        "Pickstall never holds your money.",
        "You are the seller, not the platform.",
        PAYPAL_LINE,
      ],
    },
    {
      topic: "Flat monthly plans instead of a cut of every sale",
      headline: "Why I don't take a cut of your sales",
      points: [
        "A percentage fee grows every time you sell more.",
        "A flat plan stays the same when you grow.",
        PAYPAL_LINE,
        `Plans start at ${starter} a month, with a ${TRIAL_DAYS}-day free trial.`,
      ],
    },
  ],
  story: [
    {
      topic: "Why I'm building Pickstall",
      headline: "Why I'm building Pickstall",
      points: [
        "Creators told me link-in-bio stores take a cut of every sale.",
        "Others charge a lot for the tools that matter.",
        "So I'm building a store with flat monthly plans.",
        PAYPAL_LINE,
      ],
    },
    {
      topic: "Lessons from building a startup alone",
      headline: "What building a startup alone is teaching me",
      points: [
        "Shipping small beats planning big.",
        "Talking to creators beats guessing.",
        "Saying no to features keeps the product simple.",
        "Being honest about fees builds trust.",
      ],
    },
    {
      topic: "The founding creators offer",
      headline: `Looking for ${FOUNDING_SPOTS} founding creators`,
      points: [
        `The first ${FOUNDING_SPOTS} founding creators get ${FOUNDING_MONTHS} months free.`,
        "I help set up the store and move the products over.",
        `Every new store also gets a ${TRIAL_DAYS}-day free trial with Pro features.`,
        "No card needed to start.",
      ],
    },
    {
      topic: "Who Pickstall is for",
      headline: "Who I'm building Pickstall for",
      points: [
        "Creators who sell guides, templates and courses.",
        "Coaches who sell 1:1 calls.",
        "Anyone who wants one simple link that sells.",
        "People who want to keep more of each sale.",
      ],
    },
  ],
};

/** The topic for a pillar and rotation index (never "build", which is made from real numbers). */
export function topicFor(pillar: Exclude<ContentPillar, "build">, index: number): Topic {
  const list = TOPICS[pillar];
  return list[((index % list.length) + list.length) % list.length] as Topic;
}
