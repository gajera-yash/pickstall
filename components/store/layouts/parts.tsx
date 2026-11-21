import { BookOpen, CalendarCheck, Download, Gift, PlayCircle } from "lucide-react";

import { RatingBadge } from "@/components/store/stars";
import { PriceTag } from "@/components/store/price-tag";
import type { StoreTheme } from "@/components/store/store-theme";
import { durationLabel } from "@/lib/coaching/settings";
import { COURSE_CATEGORY_LABELS, accessLabel } from "@/lib/courses/settings";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicProduct } from "@/lib/stores/public";
import { cn } from "@/lib/utils";

// Small pieces the store layouts share (D-063). Colors come from the creator's theme data.

/**
 * The product cover. Without one, an "auto cover" in the creator's accent: a soft gradient, the
 * product type's icon and the title (decorative: the title is always shown as text nearby), so a
 * product without an image still looks finished. `compact` (small thumbnails) shows the icon only.
 */
export function ProductCover({ product, theme, className, compact = false }: { product: PublicProduct; theme: StoreTheme; className?: string; compact?: boolean }) {
  const src = safeImageSrc(product.coverUrl);
  if (src) {
    // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className={cn("w-full object-cover", className)} />;
  }
  const { accent, onAccent, preset } = theme;
  const Icon = product.type === "course" ? PlayCircle : product.type === "coaching" ? CalendarCheck : product.type === "lead_magnet" ? Gift : Download;
  return (
    <span
      aria-hidden="true"
      className={cn("relative isolate flex w-full overflow-hidden", compact ? "items-center justify-center" : "", className)}
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 26%, ${preset.card}) 0%, color-mix(in srgb, ${accent} 8%, ${preset.card}) 100%)`, color: accent }}
    >
      <span className="absolute -top-12 -right-10 -z-10 size-44 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }} />
      <span className="absolute -bottom-14 -left-8 -z-10 size-36 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)` }} />
      {compact ? (
        <Icon className="size-8" />
      ) : (
        <span className="flex size-full flex-col justify-between gap-3 p-5">
          <span className="flex size-10 items-center justify-center rounded-full shadow-sm" style={{ background: accent, color: onAccent }}>
            <Icon className="size-5" />
          </span>
          <span className="line-clamp-3 font-display text-h2 leading-tight break-words" style={{ color: preset.text, fontWeight: preset.displayWeight }}>
            {product.title}
          </span>
        </span>
      )}
    </span>
  );
}

/** "Course · 12 lessons" or "Digital product". */
export function ProductKind({ product, theme }: { product: PublicProduct; theme: StoreTheme }) {
  const course = product.course;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.preset.muted }}>
      {course ? <BookOpen aria-hidden="true" className="size-3.5" /> : product.type === "coaching" ? <CalendarCheck aria-hidden="true" className="size-3.5" /> : <Download aria-hidden="true" className="size-3.5" />}
      {course
        ? `Course · ${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}`
        : product.type === "coaching"
          ? `Coaching call · ${durationLabel(product.coaching?.durationMinutes ?? 30)}`
          : product.type === "lead_magnet"
            ? "Free download"
            : "Digital product"}
      {product.rating && product.rating.count > 0 && (
        <span className="ml-1 inline-flex items-center" style={{ color: theme.preset.text }}>
          <RatingBadge average={product.rating.average} count={product.rating.count} color={theme.accent} mutedColor={theme.preset.muted} />
        </span>
      )}
    </span>
  );
}

/** A course's category and access period, for catalog cards. */
export function courseMeta(product: PublicProduct): { category: string | null; access: string | null } {
  if (!product.course) return { category: null, access: null };
  return { category: product.course.category ? COURSE_CATEGORY_LABELS[product.course.category] : null, access: accessLabel(product.course.accessDays) };
}

/** The price (Free for a free course) and the creator's button, in the theme's accent. */
export function PriceAndButton({ product, theme, currency }: { product: PublicProduct; theme: StoreTheme; currency: string }) {
  const { preset } = theme;
  return (
    <span className="flex flex-wrap items-center justify-between gap-3">
      {product.priceCents === 0 ? (
        <span className="font-display text-money-m">Free</span>
      ) : (
        <PriceTag product={product} currency={currency} className="font-display text-money-m" regularStyle={{ color: preset.muted }} />
      )}
      <span className="flex h-11 items-center px-5 text-button" style={{ background: theme.accent, color: theme.onAccent, borderRadius: Math.min(preset.radiusPx, 12) }}>
        {product.buttonText || (product.type === "course" ? "Enroll now" : product.type === "coaching" ? "Book a call" : product.type === "lead_magnet" ? "Get it free" : "Buy now")}
      </span>
    </span>
  );
}
