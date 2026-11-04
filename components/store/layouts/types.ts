import type { StoreTheme } from "@/components/store/store-theme";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

/** What every store layout gets (D-062). `preview` renders it inside the dashboard's live preview. */
export type StoreLayoutProps = { store: PublicStore; products: PublicProduct[]; theme: StoreTheme; preview?: boolean };
