import { BookOpen, Download, ImageIcon, PlayCircle } from "lucide-react";

import { PriceTag } from "@/components/store/price-tag";
import type { StoreTheme } from "@/components/store/store-theme";
import { COURSE_CATEGORY_LABELS, accessLabel } from "@/lib/courses/settings";
import { safeImageSrc } from "@/lib/media/media";
import type { PublicProduct } from "@/lib/stores/public";
import { cn } from "@/lib/utils";

// Small pieces the store layouts share (D-063). Colors come from the creator's theme data.

/** The product cover, or a quiet placeholder in the theme's accent when there is none. */
export function ProductCover({ product, theme, className }: { product: PublicProduct; theme: StoreTheme; className?: string }) {
  const src = safeImageSrc(product.coverUrl);
  if (src) {
    // A creator's own https link on any host, so next/image (fixed remote hosts) cannot load it.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className={cn("w-full object-cover", className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("flex w-full items-center justify-center", className)} style={{ background: `color-mix(in srgb, ${theme.accent} 14%, ${theme.preset.card})`, color: theme.accent }}>
      {product.type === "course" ? <PlayCircle className="size-10" /> : <ImageIcon className="size-10" />}
    </span>
  );
}

/** "Course · 12 lessons" or "Digital product". */
export function ProductKind({ product, theme }: { product: PublicProduct; theme: StoreTheme }) {
  const course = product.course;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.preset.muted }}>
      {course ? <BookOpen aria-hidden="true" className="size-3.5" /> : <Download aria-hidden="true" className="size-3.5" />}
      {course ? `Course · ${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}` : "Digital product"}
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
        {product.buttonText || (product.type === "course" ? "Enroll now" : "Buy now")}
      </span>
    </span>
  );
}
