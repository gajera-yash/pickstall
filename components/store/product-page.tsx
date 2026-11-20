import { ArrowLeft, CheckCircle2, ChevronDown, Clock, FileText, ListTree, Lock, PlayCircle, ShieldCheck } from "lucide-react";
import { Stars } from "@/components/store/stars";
import type { PublicReview } from "@/lib/reviews/public";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ProductCover, ProductKind } from "@/components/store/layouts/parts";
import { MobileBuyBar } from "@/components/store/mobile-buy-bar";
import { PriceTag } from "@/components/store/price-tag";
import { RichTextView } from "@/components/store/rich-text";
import { StoreFrame, borderColor, cardStyle, resolveTheme, type StoreTheme } from "@/components/store/store-theme";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { durationLabel } from "@/lib/coaching/settings";
import { accessLabel } from "@/lib/courses/settings";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicCurriculum, PublicProduct, PublicStore } from "@/lib/stores/public";

const BUY_BUTTON_ID = "product-buy";

/**
 * Public product page (PRD F4, redesigned in D-068). On a phone: store strip, cover and title, the
 * buy box, then the description and course content, with a buy bar at the bottom once the button
 * has scrolled away. On a wide page (@3xl): the story on the left and the buy box on the right,
 * staying in view. Price shown is information only; checkout recomputes it on the server. Nothing
 * private (delivery link, questions, email text) is on this page.
 */
const REVIEW_DATE = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export function ProductPage({ store, product, buyable, curriculum = null, reviews = [] }: { store: PublicStore; product: PublicProduct; buyable: boolean; curriculum?: PublicCurriculum | null; reviews?: PublicReview[] }) {
  const theme = resolveTheme(store.theme);
  const { preset } = theme;
  const outline = curriculum && product.course ? curriculum : null;
  const hasDetails = Boolean(product.descriptionDoc || product.description || outline);

  return (
    <StoreFrame theme={theme} wide>
      <div className="flex w-full max-w-xl flex-col gap-6 @3xl:max-w-5xl">
        <StoreStrip store={store} theme={theme} />

        <div className="grid w-full gap-6 @3xl:grid-cols-[minmax(0,1fr)_340px] @3xl:items-start @3xl:gap-8">
          <section aria-labelledby="product-title" className="flex flex-col gap-5 overflow-hidden p-5 @3xl:col-start-1" style={cardStyle(theme)}>
            <ProductCover product={product} theme={theme} className="aspect-video rounded-md" />
            <div className="flex flex-col gap-2">
              <ProductKind product={product} theme={theme} />
              <h1 id="product-title" className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
                {product.title}
              </h1>
            </div>
          </section>

          <aside aria-label="Buy" className="flex flex-col gap-4 p-5 @3xl:sticky @3xl:top-8 @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1" style={cardStyle(theme)}>
            <BuyBox store={store} product={product} theme={theme} buyable={buyable} curriculum={outline} />
          </aside>

          {hasDetails && (
            <section aria-label="About this product" className="flex flex-col gap-6 p-5 @3xl:col-start-1" style={cardStyle(theme)}>
              {product.descriptionDoc ? (
                <RichTextView doc={product.descriptionDoc} className="text-body-l" linkStyle={{ color: preset.text }} />
              ) : (
                // Products saved before D-049 have a plain description only.
                product.description && (
                  <p className="text-body-l break-words whitespace-pre-line" style={{ color: preset.muted }}>
                    {product.description}
                  </p>
                )
              )}
              {outline && product.course && <CourseOutline curriculum={outline} accessDays={product.course.accessDays} muted={preset.muted} />}
            </section>
          )}

          {reviews.length > 0 && product.rating && (
            <section aria-labelledby="product-reviews" className="flex flex-col gap-4 p-5 @3xl:col-start-1" style={cardStyle(theme)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="product-reviews" className="font-display text-h3" style={{ fontWeight: preset.displayWeight }}>
                  Reviews
                </h2>
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Stars rating={product.rating.average} color={theme.accent} />
                  {product.rating.average.toFixed(1)}
                  <span style={{ color: preset.muted }}>
                    ({product.rating.count.toLocaleString("en")} {product.rating.count === 1 ? "review" : "reviews"})
                  </span>
                </span>
              </div>
              <ul className="flex flex-col divide-y" style={{ borderColor: borderColor(preset) }}>
                {reviews.map((review) => (
                  <li key={review.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0" style={{ borderColor: borderColor(preset) }}>
                    <span className="flex flex-wrap items-center gap-2">
                      <Stars rating={review.rating} size="size-3.5" color={theme.accent} />
                      <span className="text-sm font-semibold">{review.buyerName}</span>
                      <span className="text-xs" style={{ color: preset.muted }}>
                        {REVIEW_DATE.format(review.createdAt)}
                      </span>
                    </span>
                    {review.text && (
                      <p className="break-words whitespace-pre-line" style={{ color: preset.muted }}>
                        {review.text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {buyable && (
        <>
          {/* Room for the phone buy bar, so it never covers the page's last lines. */}
          <div aria-hidden="true" className="h-16 @3xl:hidden" />
          <MobileBuyBar targetId={BUY_BUTTON_ID} style={{ background: preset.card, color: preset.text, borderColor: borderColor(preset) }}>
            <Price product={product} store={store} theme={theme} className="text-money-m" />
            <Button asChild className="h-11 px-5" style={buttonStyle(theme)}>
              <Link href={checkoutHref(store, product)}>{buttonLabel(product)}</Link>
            </Button>
          </MobileBuyBar>
        </>
      )}
    </StoreFrame>
  );
}

/** Back link to the store: the creator's photo (or initial) and name. */
function StoreStrip({ store, theme }: { store: PublicStore; theme: StoreTheme }) {
  const avatar = safeImageSrc(store.avatarUrl);
  return (
    <Link href={`/@${store.slug}`} className="inline-flex min-h-11 items-center gap-3 self-start text-sm font-semibold" style={{ color: theme.preset.text }}>
      <ArrowLeft aria-hidden="true" className="size-4" style={{ color: theme.preset.muted }} />
      {avatar ? (
        // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full text-sm" style={{ background: theme.accent, color: theme.onAccent }}>
          {store.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      <span className="break-words">{store.name}</span>
    </Link>
  );
}

/** Price, the Buy button (or why it is off), what the buyer gets and a secure-checkout note. */
function BuyBox({ store, product, theme, buyable, curriculum }: { store: PublicStore; product: PublicProduct; theme: StoreTheme; buyable: boolean; curriculum: PublicCurriculum | null }) {
  const { preset } = theme;
  const course = product.course;
  const lessons = curriculum ? curriculum.modules.reduce((sum, item) => sum + item.lessons.length, 0) : (course?.lessonCount ?? 0);
  const perks = course
    ? [
        `${lessons} ${lessons === 1 ? "lesson" : "lessons"}${curriculum ? ` in ${curriculum.modules.length} ${curriculum.modules.length === 1 ? "module" : "modules"}` : ""}`,
        accessLabel(course.accessDays),
        "Learn at your own pace",
      ]
    : product.type === "coaching"
      ? [`A ${durationLabel(product.coaching?.durationMinutes ?? 30)} one-to-one call`, "Pick a time that suits you at checkout", "Booking and calendar invite by email"]
      : product.type === "lead_magnet"
        ? ["Free: just your name and email", "Sent to your inbox right away", "Also kept in your library"]
        : ["Delivered by email right after payment", "Also kept in your library"];

  return (
    <>
      <Price product={product} store={store} theme={theme} className="text-money-l" />
      {buyable ? (
        // The creator's theme colors (theme data) override the button's own.
        <Button asChild size="lg" className="w-full" style={buttonStyle(theme)}>
          <Link id={BUY_BUTTON_ID} href={checkoutHref(store, product)}>
            {buttonLabel(product)}
          </Link>
        </Button>
      ) : (
        <>
          <Button type="button" size="lg" disabled className="w-full" style={buttonStyle(theme)}>
            <Lock aria-hidden="true" className="size-4" />
            {buttonLabel(product)}
          </Button>
          <p className="text-center text-sm" style={{ color: preset.muted }}>
            Payments aren&apos;t set up for this store yet. Please check back soon.
          </p>
        </>
      )}
      <ul className="flex flex-col gap-2 border-t pt-4 text-sm" style={{ borderColor: borderColor(preset) }}>
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" style={{ color: theme.accent }} />
            <span className="break-words">{perk}</span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 text-xs" style={{ color: preset.muted }}>
        <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
        Secure checkout. Sold by {store.name}.
      </p>
    </>
  );
}

function Price({ product, store, theme, className }: { product: PublicProduct; store: PublicStore; theme: StoreTheme; className: string }) {
  return (
    <p className={`font-display ${className}`}>
      {product.priceCents === 0 ? (
        "Free"
      ) : (
        <PriceTag product={product} currency={store.currency} regularStyle={{ color: theme.preset.muted }} />
      )}
    </p>
  );
}

function checkoutHref(store: PublicStore, product: PublicProduct): string {
  return `/@${store.slug}/${product.slug}/checkout`;
}

function buttonLabel(product: PublicProduct): string {
  return product.buttonText || (product.type === "coaching" ? "Book a call" : product.type === "lead_magnet" ? "Get it free" : "Buy now");
}

function buttonStyle(theme: StoreTheme): CSSProperties {
  return { background: theme.accent, color: theme.onAccent, borderRadius: Math.min(theme.preset.radiusPx, 12) };
}

/** What a course holds (D-056): modules and lesson titles, lesson count and how long access lasts. */
function CourseOutline({ curriculum, accessDays, muted }: { curriculum: PublicCurriculum; accessDays: number | null; muted: string }) {
  const lessons = curriculum.modules.reduce((sum, item) => sum + item.lessons.length, 0);
  return (
    <section aria-labelledby="course-content" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="course-content" className="font-display text-h3">
          Course content
        </h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: muted }}>
          <span className="inline-flex items-center gap-1">
            <ListTree aria-hidden="true" className="size-4" />
            {curriculum.modules.length} {curriculum.modules.length === 1 ? "module" : "modules"}, {lessons} {lessons === 1 ? "lesson" : "lessons"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-4" />
            {accessLabel(accessDays)}
          </span>
        </p>
      </div>
      <Accordion type="multiple" defaultValue={curriculum.modules.length > 0 ? ["0"] : []}>
        {curriculum.modules.map((item, index) => (
          <AccordionItem key={index} value={String(index)} style={{ borderColor: "color-mix(in srgb, currentColor 15%, transparent)" }}>
            <AccordionTrigger
              icon={<ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-data-[state=open]/accordion-trigger:rotate-180" style={{ color: muted }} />}
            >
              <span className="flex min-w-0 flex-col">
                <span className="break-words">{item.title}</span>
                <span className="text-xs font-normal" style={{ color: muted }}>
                  {item.lessons.length} {item.lessons.length === 1 ? "lesson" : "lessons"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="flex flex-col gap-2">
                {item.lessons.map((lesson, lessonIndex) => (
                  <li key={lessonIndex} className="flex items-center gap-2">
                    {lesson.hasVideo ? (
                      <PlayCircle aria-hidden="true" className="size-4 shrink-0" style={{ color: muted }} />
                    ) : (
                      <FileText aria-hidden="true" className="size-4 shrink-0" style={{ color: muted }} />
                    )}
                    <span className="break-words">{lesson.title}</span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
