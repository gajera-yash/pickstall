import { BarChart3, CreditCard, EyeOff, LayoutTemplate, ListChecks, MousePointerClick, Package, PenLine } from "lucide-react";

import { AnalyticsShowcase } from "@/components/landing/showcase-analytics";
import { CheckoutShowcase } from "@/components/landing/showcase-checkout";
import { ProductShowcase } from "@/components/landing/showcase-products";
import { StorefrontShowcase } from "@/components/landing/showcase-storefront";
import { Container, PointList, SectionHeading } from "@/components/landing/ui";

// The product tour (D-039): storefront, product management, checkout and analytics, each with a
// working example of the real screen. Section shells are server components.

export function StorefrontSection() {
  return (
    <section id="product" aria-labelledby="storefront-title" className="scroll-mt-20 border-t border-line bg-bg-subtle py-20 sm:py-28">
      <Container>
        <StorefrontShowcase
          intro={
            <SectionHeading id="storefront-title" eyebrow="Storefront" icon={LayoutTemplate} title="A store that looks like you," muted="in a few taps.">
              Three themes, your accent color, your photo and links. Pick one and watch the store change.
            </SectionHeading>
          }
        />
      </Container>
    </section>
  );
}

export function ProductsSection() {
  const points = [
    { icon: PenLine, title: "Edit and see it live", body: "Title, cover, price and button text, with a preview of exactly what buyers see." },
    { icon: MousePointerClick, title: "Price with an optional discount", body: "Set a price, then turn on a discount; buyers see the old price struck through." },
    { icon: EyeOff, title: "Draft until it's ready", body: "Publish when you're happy. Drafts stay hidden from your store." },
  ];
  return (
    <section aria-labelledby="products-title" className="py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
        <div className="flex flex-col gap-8">
          <SectionHeading id="products-title" eyebrow="Product management" icon={Package} title="Add a product" muted="before your coffee cools." />
          <PointList items={points} />
        </div>
        <ProductShowcase />
      </Container>
    </section>
  );
}

export function CheckoutSection() {
  return (
    <section aria-labelledby="checkout-title" className="border-y border-line bg-bg-subtle py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading id="checkout-title" eyebrow="Checkout" icon={CreditCard} title="From tap to paid," muted="with nothing in between.">
          A short checkout made for phones, a receipt with no platform fee, and delivery the moment the payment is confirmed.
        </SectionHeading>
        <CheckoutShowcase />
      </Container>
    </section>
  );
}

export function AnalyticsSection() {
  const points = [
    { icon: BarChart3, title: "Every dollar, every day", body: "Revenue, orders and customers for today, 7 days or 30 days." },
    { icon: ListChecks, title: "Know your buyers", body: "Every order, buyer and checkout answer in one place. Export to CSV whenever you like." },
  ];
  return (
    <section aria-labelledby="analytics-title" className="py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
        <div className="order-2 lg:order-1">
          <AnalyticsShowcase />
        </div>
        <div className="order-1 flex flex-col gap-8 lg:order-2">
          <SectionHeading id="analytics-title" eyebrow="Analytics" icon={BarChart3} title="Your numbers," muted="without a spreadsheet." />
          <PointList items={points} />
        </div>
      </Container>
    </section>
  );
}
