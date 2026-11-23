import { AcademyCatalog } from "@/components/store/layouts/academy-catalog";
import { StoreBlocks } from "@/components/store/store-blocks";
import { splitBlocks } from "@/lib/page-blocks/rules";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFrame, cardStyle } from "@/components/store/store-theme";

/**
 * Academy (D-063): a course catalog. The creator's profile in a wide header card with the real
 * counts of courses and other products, then category chips and the course cards.
 */
export function AcademyLayout({ store, products, theme, preview }: StoreLayoutProps) {
  const { preset } = theme;
  const { before, after } = splitBlocks(store.pageBlocks);
  const courses = products.filter((product) => product.type === "course").length;
  const others = products.length - courses;

  return (
    <StoreFrame theme={theme} preview={preview} wide slug={store.slug}>
      <div className="flex w-full flex-col gap-5 p-6 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:p-8" style={cardStyle(theme)}>
        <StoreHeader store={store} align="start" />
        <dl className="flex shrink-0 gap-3">
          {[
            { label: courses === 1 ? "Course" : "Courses", value: courses },
            { label: others === 1 ? "Other product" : "Other products", value: others },
          ]
            .filter((item) => item.value > 0)
            .map((item) => (
              <div key={item.label} className="flex min-w-24 flex-col gap-0.5 rounded-md px-4 py-3" style={{ background: preset.background }}>
                <dt className="text-xs font-semibold" style={{ color: preset.muted }}>
                  {item.label}
                </dt>
                <dd className="font-display text-h2 tabular-nums">{item.value}</dd>
              </div>
            ))}
        </dl>
      </div>

      <StoreBlocks blocks={before} theme={theme} />
      {products.length === 0 ? (
        <p className="w-full p-6 text-center" style={{ ...cardStyle(theme), color: preset.muted }}>
          Courses are coming soon. Check back later.
        </p>
      ) : (
        <AcademyCatalog storeSlug={store.slug} products={products} theme={theme} currency={store.currency} />
      )}
      <StoreBlocks blocks={after} theme={theme} />
    </StoreFrame>
  );
}
