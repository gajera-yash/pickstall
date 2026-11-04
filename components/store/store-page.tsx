import type { ReactNode } from "react";

import { AcademyLayout } from "@/components/store/layouts/academy";
import { BentoLayout } from "@/components/store/layouts/bento";
import { EditorialLayout } from "@/components/store/layouts/editorial";
import { SplitLayout } from "@/components/store/layouts/split";
import { StackLayout } from "@/components/store/layouts/stack";
import type { StoreLayoutProps } from "@/components/store/layouts/types";
import { resolveTheme } from "@/components/store/store-theme";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";
import type { StoreLayout } from "@/lib/themes";

/**
 * Public store page (PRD F2): the creator's theme decides the layout (D-062). Every layout shows
 * the same public data: header (avatar, name, bio, social links) and the published products.
 */
export function StorePage({ store, products, preview = false }: { store: PublicStore; products: PublicProduct[]; preview?: boolean }) {
  const theme = resolveTheme(store.theme);
  const Layout = STORE_LAYOUT_COMPONENTS[theme.preset.layout];
  return <Layout store={store} products={products} theme={theme} preview={preview} />;
}

const STORE_LAYOUT_COMPONENTS: Record<StoreLayout, (props: StoreLayoutProps) => ReactNode> = {
  stack: StackLayout,
  split: SplitLayout,
  academy: AcademyLayout,
  editorial: EditorialLayout,
  bento: BentoLayout,
};
