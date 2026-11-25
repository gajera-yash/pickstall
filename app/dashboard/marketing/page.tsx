import { BarChart3, Filter, HandCoins, Mail, MailCheck, Megaphone, Palette, ShoppingBag, ShoppingCart, Star, Ticket, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Hotspot } from "@/components/tours/hotspot";
import { PageTour } from "@/components/tours/tour-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { EMAIL_LOOK_LABELS } from "@/lib/email/looks";
import { marketingOverview, type MarketingOverview } from "@/lib/marketing/overview";
import { can } from "@/lib/plans/access";
import { listProducts } from "@/lib/products/queries";
import type { HotspotId } from "@/lib/tours/catalog";

// Marketing overview (D-129): no forms here. Every tool is a card with one line on what it does, its
// status right now and a link to its own page. Grouped so a new creator knows where to start.

type Tool = { title: string; description: string; icon: LucideIcon; href: string; status: string; on?: boolean; pro?: boolean; hotspot?: HotspotId; tour?: string };
type Group = { title: string; tools: Tool[] };

const n = (value: number, one: string, many: string) => `${value.toLocaleString("en")} ${value === 1 ? one : many}`;
const unknown = "Open to see";

function groups(data: MarketingOverview, locked: boolean): Group[] {
  const { offers } = data;
  return [
    {
      title: "Discounts and offers",
      tools: [
        { title: "Coupons", description: "Discount codes buyers enter at checkout.", icon: Ticket, href: "/dashboard/marketing/coupons", status: data.coupons ? n(data.coupons.active, "active code", "active codes") : unknown, on: (data.coupons?.active ?? 0) > 0, tour: "marketing-coupons" },
        { title: "Order bumps", description: "One more product at checkout with a single tick.", icon: ShoppingCart, href: "/dashboard/marketing/offers", status: offers.bumps ? `On ${n(offers.bumps, "product", "products")}` : "Not set yet", on: offers.bumps > 0 },
        { title: "Upsell and downsell", description: "A special offer right after someone buys.", icon: ShoppingBag, href: "/dashboard/marketing/offers", status: offers.upsells ? `On ${n(offers.upsells, "product", "products")}` : "Not set yet", on: offers.upsells > 0, pro: locked },
        { title: "Funnels", description: "How many buyers take each offer.", icon: Filter, href: "/dashboard/marketing/funnels", status: offers.upsells || offers.downsells ? "See the numbers" : "Add an upsell first", hotspot: "new-funnels" },
      ],
    },
    {
      title: "Email marketing",
      tools: [
        { title: "Email list", description: "Everyone who joined from a free download or at checkout.", icon: Mail, href: "/dashboard/marketing/subscribers", status: data.subscribers === null ? unknown : n(data.subscribers, "subscriber", "subscribers"), on: (data.subscribers ?? 0) > 0 },
        { title: "Broadcasts", description: "Email your whole list at once.", icon: Megaphone, href: "/dashboard/marketing/broadcasts", status: data.lastBroadcastAt ? `Last sent ${data.lastBroadcastAt.toLocaleDateString("en", { month: "short", day: "numeric" })}` : "None sent yet" },
        { title: "Email design", description: "One look for every email you send.", icon: Palette, href: "/dashboard/marketing/emails", status: data.emailLook ? `${EMAIL_LOOK_LABELS[data.emailLook].name} design` : "Default design", hotspot: "new-email-design", tour: "marketing-email-design" },
      ],
    },
    {
      title: "Automations",
      tools: [
        { title: "Welcome email", description: "Sent once to every new subscriber.", icon: MailCheck, href: "/dashboard/marketing/automations", status: data.welcomeOn ? "On" : "Off", on: data.welcomeOn, pro: locked },
        { title: "Abandoned cart", description: "One reminder to buyers who didn't finish checkout.", icon: ShoppingCart, href: "/dashboard/marketing/automations", status: data.cart ? (data.cart.on ? `On · ${n(data.cart.sent, "sent", "sent")}, ${data.cart.recovered} bought` : "Off") : unknown, on: data.cart?.on, pro: locked },
        { title: "Review request", description: "Asks buyers for a rating a week after they buy.", icon: Star, href: "/dashboard/marketing/automations", status: data.reviewOn === null ? unknown : data.reviewOn ? "On" : "Off", on: data.reviewOn ?? false, pro: locked, hotspot: "new-review-request" },
      ],
    },
    {
      title: "Grow and track",
      tools: [
        { title: "Affiliates", description: "People who share your store for a commission.", icon: HandCoins, href: "/dashboard/marketing/affiliates", status: data.affiliates ? n(data.affiliates.active, "affiliate", "affiliates") : unknown, on: (data.affiliates?.active ?? 0) > 0, hotspot: "new-affiliates" },
        { title: "Pixels", description: "Measure your Meta and Google ads.", icon: BarChart3, href: "/dashboard/marketing/pixels", status: data.pixels ? [data.pixels.meta && "Meta", data.pixels.google && "Google"].filter(Boolean).join(" and ") || "Not connected" : unknown, on: Boolean(data.pixels?.meta || data.pixels?.google) },
      ],
    },
  ];
}

export default function MarketingPage() {
  return (
    <>
      <PageHeader title="Marketing" description="Tools to sell more to the audience you already have. New here? Start with a coupon, then turn on the abandoned cart email." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <MarketingContent />
      </Suspense>
    </>
  );
}

async function MarketingContent() {
  const { user, store } = await requireUnlockedCreator("/dashboard/marketing");
  const products = await listProducts(store.id).catch(() => []);
  const data = await marketingOverview(store.id, user.id, products);
  const locked = !can(store.access, "automations");

  return (
    <div className="flex flex-col gap-8" data-tour="marketing-tools">
      <PageTour id="marketing" />
      {groups(data, locked).map((group) => (
        <section key={group.title} aria-labelledby={`group-${group.title}`} className="flex flex-col gap-3">
          <h2 id={`group-${group.title}`} className="font-display text-h3">
            {group.title}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {group.tools.map((tool) => (
              <li key={tool.title} className="relative" {...(tool.tour ? { "data-tour": tool.tour } : {})}>
                <Card className="h-full gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-blue-soft text-blue">
                      <tool.icon className="size-5" />
                    </span>
                    <span className="flex items-center gap-1">
                      {/* Above the card's stretched link, so the dot can be clicked on its own. */}
                      {tool.hotspot && <Hotspot id={tool.hotspot} className="relative z-10" />}
                      {tool.pro && <Badge variant="soon">Pro</Badge>}
                    </span>
                  </div>
                  <h3 className="font-display text-h4">
                    <Link href={tool.href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-blue">
                      {tool.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-mute">{tool.description}</p>
                  <Badge variant={tool.on ? "live" : "draft"} className="mt-auto self-start">
                    {tool.status}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
