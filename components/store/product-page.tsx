import { ArrowLeft, ChevronDown, Clock, FileText, ListTree, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";

import { PriceTag } from "@/components/store/price-tag";
import { RichTextView } from "@/components/store/rich-text";
import { StoreHeader } from "@/components/store/store-page";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { accessLabel } from "@/lib/courses/settings";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicCurriculum, PublicProduct, PublicStore } from "@/lib/stores/public";

/**
 * Public product page (PRD F4): cover, title, description, price (with the regular price struck
 * through when discounted, D-047) and the Buy button; a course also lists its modules and lessons
 * (titles only, D-056). Checkout is built in R5, so the button is disabled and says why; nothing
 * private (delivery link, questions, email text) is on this page.
 */
export function ProductPage({ store, product, buyable, curriculum = null }: { store: PublicStore; product: PublicProduct; buyable: boolean; curriculum?: PublicCurriculum | null }) {
  const theme = resolveTheme(store.theme);
  const { preset } = theme;

  return (
    <StoreFrame theme={theme}>
      <Link href={`/@${store.slug}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold" style={{ color: preset.muted }}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {store.name}
      </Link>
      <article className="flex w-full flex-col gap-5 overflow-hidden p-5" style={cardStyle(theme)}>
        {safeImageSrc(product.coverUrl) && (
          // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeImageSrc(product.coverUrl) ?? ""} alt="" referrerPolicy="no-referrer" className="aspect-video w-full rounded-md object-cover" />
        )}
        <h1 className="font-display text-h1 break-words" style={{ fontWeight: preset.displayWeight }}>
          {product.title}
        </h1>
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
        <p className="font-display text-money-l">
          {product.type === "course" && product.priceCents === 0 ? "Free" : <PriceTag product={product} currency={store.currency} regularStyle={{ color: preset.muted }} />}
        </p>
        {buyable ? (
          // The creator's theme colors (theme data) override the button's own.
          <Button asChild size="lg" className="w-full" style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}>
            <Link href={`/@${store.slug}/${product.slug}/checkout`}>{product.buttonText || "Buy now"}</Link>
          </Button>
        ) : (
          <>
            <Button type="button" size="lg" disabled className="w-full" style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}>
              <Lock aria-hidden="true" className="size-4" />
              {product.buttonText || "Buy now"}
            </Button>
            <p className="text-center text-sm" style={{ color: preset.muted }}>
              Payments aren&apos;t set up for this store yet. Please check back soon.
            </p>
          </>
        )}
        {curriculum && product.course && <CourseOutline curriculum={curriculum} accessDays={product.course.accessDays} muted={preset.muted} />}
      </article>
      <StoreHeader store={store} linkToStore />
    </StoreFrame>
  );
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
            <AccordionTrigger icon={<ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-data-[state=open]/accordion-trigger:rotate-180" style={{ color: muted }} />}>
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
                    {lesson.hasVideo ? <PlayCircle aria-hidden="true" className="size-4 shrink-0" style={{ color: muted }} /> : <FileText aria-hidden="true" className="size-4 shrink-0" style={{ color: muted }} />}
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
