import { PLAN_LIMITS, type PaidPlan } from "@/lib/config";

// What each paid plan includes, for the Plan page (PRD F9, D-098). Built from PLAN_LIMITS, so the
// page always matches what is enforced. `true` / `false` for included or not, or a short value.

export type PlanFeatureRow = { label: string; hint?: string; values: Record<PaidPlan, string | boolean> };

const n = (value: number) => value.toLocaleString("en");
const courses = (plan: PaidPlan) => (PLAN_LIMITS[plan].maxCourses === null ? "Unlimited" : `Up to ${n(PLAN_LIMITS[plan].maxCourses as number)}`);
const has = (plan: PaidPlan, feature: "coaching" | "automations" | "upsells") => PLAN_LIMITS[plan].features.includes(feature);

export const PLAN_FEATURE_GROUPS: { title: string; rows: PlanFeatureRow[] }[] = [
  {
    title: "Sell",
    rows: [
      { label: "Digital products and downloads", values: { starter: "Unlimited", pro: "Unlimited" } },
      { label: "Courses", values: { starter: courses("starter"), pro: courses("pro") } },
      { label: "Course video hosting", values: { starter: `${PLAN_LIMITS.starter.videoHours} hours`, pro: `${PLAN_LIMITS.pro.videoHours} hours` } },
      { label: "Coaching calls with booking", values: { starter: has("starter", "coaching"), pro: has("pro", "coaching") } },
      { label: "Course quizzes and certificates", values: { starter: true, pro: true } },
      { label: "License keys for software and templates", values: { starter: true, pro: true } },
      { label: "Free lead magnets (collect emails)", values: { starter: true, pro: true } },
      { label: "0% Pickstall transaction fee", hint: "Stripe's card fees still apply.", values: { starter: true, pro: true } },
    ],
  },
  {
    title: "Grow",
    rows: [
      { label: "Coupons", values: { starter: true, pro: true } },
      { label: "Order bumps at checkout", values: { starter: true, pro: true } },
      { label: "Upsell and downsell after purchase", values: { starter: has("starter", "upsells"), pro: has("pro", "upsells") } },
      { label: "Email subscribers", values: { starter: n(PLAN_LIMITS.starter.emailSubscribers), pro: n(PLAN_LIMITS.pro.emailSubscribers) } },
      { label: "Broadcast emails", values: { starter: true, pro: true } },
      { label: "Welcome email, abandoned cart and review request", values: { starter: has("starter", "automations"), pro: has("pro", "automations") } },
      { label: "Meta and Google pixels", values: { starter: true, pro: true } },
      { label: "Affiliate links with commissions", values: { starter: true, pro: true } },
    ],
  },
  {
    title: "Your store",
    rows: [
      { label: "9 store themes and page sections", values: { starter: true, pro: true } },
      { label: "Orders, customers and CSV exports", values: { starter: true, pro: true } },
      { label: "Import your email list", values: { starter: true, pro: true } },
    ],
  },
];
