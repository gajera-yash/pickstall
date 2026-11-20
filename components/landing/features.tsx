import { ArrowRight, Blocks, Library, Link2, Lock, Mail, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { COMING_SOON, STEPS } from "@/components/landing/content";
import { DiscountTile } from "@/components/landing/feature-tiles";
import { Container, SectionHeading } from "@/components/landing/ui";
import { Badge } from "@/components/ui/badge";
import { storeLink } from "@/lib/config";
import { cn } from "@/lib/utils";

// Features as a bento grid (D-039): wide tiles for the ideas that need a picture, small ones for the
// rest. Example content only; the small live UIs come from feature-tiles.tsx.

function Tile({ title, body, icon: Icon, className, children }: { title: string; body: string; icon: typeof Sparkles; className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-6 overflow-hidden rounded-lg border border-line bg-surface p-5 transition-[border-color,translate] duration-(--dur-base) ease-(--ease-out) hover:-translate-y-0.5 hover:border-input sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <Icon aria-hidden="true" className="size-5 text-blue" />
        <h3 className="text-h3">{title}</h3>
        <p className="text-sm text-mute text-pretty">{body}</p>
      </div>
      {children && <div className="mt-auto">{children}</div>}
    </div>
  );
}

function LinkInBio() {
  const socials = (["instagram", "tiktok", "youtube"] as const).map((kind) => ({ kind, Icon: SOCIAL_ICONS[kind] }));
  return (
    <div aria-hidden="true" className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-blue-soft font-display text-sm font-extrabold text-blue">MS</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Maya&apos;s Money Studio</p>
            <p className="text-xs text-mute">Budgeting guides for freelancers</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-blue">
          <Link2 className="size-4 shrink-0" />
          {storeLink("maya")}
        </p>
        <div className="flex gap-1.5">
          {socials.map(({ kind, Icon }) => (
            <span key={kind} className="flex size-7 items-center justify-center rounded-full border border-line bg-surface">
              <Icon className="size-3.5 text-mute" />
            </span>
          ))}
        </div>
      </div>
      <ArrowRight className="mx-auto size-5 rotate-90 text-mute sm:rotate-0" />
      <div className="flex flex-col gap-2 rounded-md border-2 border-border-strong bg-surface p-3 shadow-hard-sm">
        {[
          { title: "Freelancer budget workbook", price: "$9" },
          { title: "Tax season checklist", price: "$19" },
        ].map((item) => (
          <div key={item.title} className="flex items-center justify-between gap-2 rounded-sm border border-line px-3 py-2">
            <span className="truncate text-sm font-semibold">{item.title}</span>
            <span className="shrink-0 rounded-full bg-blue px-2.5 py-0.5 text-xs font-semibold text-on-blue tabular-nums">{item.price}</span>
          </div>
        ))}
        <p className="text-center text-xs text-mute">One tap to buy</p>
      </div>
    </div>
  );
}

function EmailPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-4 text-sm">
      <p className="flex items-center justify-between gap-2 text-xs text-mute">
        <span>From Maya&apos;s Money Studio</span>
        <span>now</span>
      </p>
      <p className="font-semibold">Your workbook is here, Jordan</p>
      <p className="text-mute">Thanks for buying Freelancer budget workbook. Open it any time from your library.</p>
      <span className="mt-1 self-start rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-on-blue">Open your purchase</span>
    </div>
  );
}

function LibraryPreview() {
  const items = [
    { title: "Freelancer budget workbook", from: "Maya's Money Studio" },
    { title: "Moody film presets", from: "Ava Lens Presets" },
  ];
  return (
    <ul aria-hidden="true" className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.title} className="flex items-center gap-3 rounded-md border border-line bg-bg-subtle p-3 text-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-soft">
            <Library className="size-5 text-blue" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{item.title}</span>
            <span className="block truncate text-xs text-mute">From {item.from}</span>
          </span>
          <span className="text-xs font-semibold text-blue">Open</span>
        </li>
      ))}
    </ul>
  );
}

export function Features() {
  const soon = COMING_SOON.slice(0, 6);
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading id="features-title" eyebrow="Features" icon={Sparkles} title="Everything you sell with," muted="on one shelf.">
          Your store, your checkout, your emails and your numbers. Customizable where it matters, safe by default.
        </SectionHeading>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Tile
            icon={Link2}
            title="One link for every bio"
            body="Your stall lives at one short link. Followers tap it and buy in a few taps, on the phone they already hold."
            className="md:col-span-2 lg:col-span-4"
          >
            <LinkInBio />
          </Tile>

          <Tile icon={Sparkles} title="Discounts that sell" body="Set a price, then add a discount. Your store shows the old price struck through." className="lg:col-span-2">
            <DiscountTile />
          </Tile>

          <Tile icon={Mail} title="Purchase emails in your words" body="Write the confirmation email yourself. The secure access link is always included." className="lg:col-span-3">
            <EmailPreview />
          </Tile>

          <Tile icon={Library} title="A library for your buyers" body="Buyers sign in with a code or password and find everything they bought in one place." className="lg:col-span-3">
            <LibraryPreview />
          </Tile>

          <Tile icon={Smartphone} title="Made for phones first" body="Big tap targets and fast pages, because your buyers come from Instagram and TikTok." className="lg:col-span-2">
            <div aria-hidden="true" className="flex items-end gap-3">
              {[
                { w: "w-10", h: "h-16", label: "Phone" },
                { w: "w-16", h: "h-20", label: "Tablet" },
                { w: "w-24", h: "h-16", label: "Desktop" },
              ].map((device) => (
                <span key={device.label} className="flex flex-col items-center gap-1.5">
                  <span className={cn("rounded-sm border-2 border-border-strong bg-bg-subtle", device.w, device.h)} />
                  <span className="text-xs text-mute">{device.label}</span>
                </span>
              ))}
            </div>
          </Tile>

          <Tile icon={ShieldCheck} title="Safe by default" body="Your text is cleaned before it is shown, and buyers get access only after a verified payment." className="lg:col-span-2">
            <p className="flex items-center gap-2 text-xs text-mute">
              <Lock aria-hidden="true" className="size-4 text-mint" />
              Card details never touch our servers.
            </p>
          </Tile>

          <Tile icon={Blocks} title="On the way" body="Courses, coupons, order bumps, emails, bookings and affiliates are already here. These come next:" className="md:col-span-2 lg:col-span-2">
            <ul className="flex flex-wrap gap-1.5">
              {soon.map((item) => (
                <li key={item} className="rounded-full border border-line bg-bg-subtle px-2.5 py-1 text-xs font-semibold">
                  {item}
                </li>
              ))}
              <li>
                <Badge variant="soon">Coming soon</Badge>
              </li>
            </ul>
          </Tile>
        </div>

        <HowItWorks />
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <div id="how-it-works" className="flex scroll-mt-24 flex-col gap-6 rounded-lg border border-line bg-bg-subtle p-5 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-h2">Live in minutes. No code.</h3>
        <p className="text-sm text-mute">From the link in your bio to money in your account.</p>
      </div>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-2">
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue font-display text-sm font-extrabold text-on-blue">{index + 1}</span>
              <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-input" />
            </span>
            <span className="font-semibold">{step.title}</span>
            <span className="text-sm text-mute">{step.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
