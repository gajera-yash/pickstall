"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PriceAndButton, ProductCover, ProductKind, courseMeta } from "@/components/store/layouts/parts";
import { cardStyle, type StoreTheme } from "@/components/store/store-theme";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PublicProduct } from "@/lib/stores/public";

const ALL = "all";
const OTHER = "other-products";

/**
 * Academy's catalog (D-063): category chips that filter the cards (each course's own category, and
 * "Other products" for downloads), then the cards with category, lesson count and access period.
 * Without JavaScript every card shows.
 */
export function AcademyCatalog({ storeSlug, products, theme, currency }: { storeSlug: string; products: PublicProduct[]; theme: StoreTheme; currency: string }) {
  const { preset } = theme;
  const [filter, setFilter] = useState(ALL);

  const keyOf = (product: PublicProduct) => (product.course ? (courseMeta(product).category ?? "Courses") : OTHER);
  const categories = [...new Set(products.map(keyOf))];
  const shown = filter === ALL ? products : products.filter((product) => keyOf(product) === filter);

  return (
    <div className="flex w-full flex-col gap-5">
      {categories.length > 1 && (
        <ToggleGroup type="single" variant="bare" aria-label="Filter by category" value={filter} onValueChange={(value) => value && setFilter(value)} className="flex-wrap gap-2">
          {[ALL, ...categories].map((key) => {
            const on = key === filter;
            return (
              <ToggleGroupItem
                key={key}
                value={key}
                className="min-h-10 rounded-full border px-4"
                style={on ? { background: theme.accent, color: theme.onAccent, borderColor: theme.accent } : { background: preset.card, color: preset.text, borderColor: "var(--line)" }}
              >
                {key === ALL ? "All" : key === OTHER ? "Other products" : key}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}

      <ul className="grid gap-5 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {shown.map((product) => {
          const meta = courseMeta(product);
          return (
            <li key={product.id}>
              <Link href={`/@${storeSlug}/${product.slug}`} className="flex h-full flex-col overflow-hidden" style={cardStyle(theme)}>
                <ProductCover product={product} theme={theme} className="aspect-video" />
                <span className="flex flex-1 flex-col gap-2 p-5">
                  {meta.category && (
                    <span className="self-start rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${theme.accent} 12%, ${preset.card})`, color: preset.text }}>
                      {meta.category}
                    </span>
                  )}
                  <span className="font-display text-h3 break-words" style={{ fontWeight: preset.displayWeight }}>
                    {product.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ProductKind product={product} theme={theme} />
                    {meta.access && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: preset.muted }}>
                        <Clock aria-hidden="true" className="size-3.5" />
                        {meta.access}
                      </span>
                    )}
                  </span>
                  {product.description && (
                    <span className="line-clamp-2 text-sm break-words" style={{ color: preset.muted }}>
                      {product.description}
                    </span>
                  )}
                  <span className="mt-auto pt-2">
                    <PriceAndButton product={product} theme={theme} currency={currency} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
