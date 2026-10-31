// First-run checklist on My Store (docs/DECISIONS.md D-009, DESIGN.md 10.8).

export type ChecklistItemId = "store-setup" | "first-product" | "connect-payments" | "publish";

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  description: string;
  done: boolean;
  /** False until the screen for this step is built; the UI then says "Coming next" instead of linking. */
  available: boolean;
  href: string;
};

export type ChecklistInput = {
  bio: string | null;
  avatarUrl: string | null;
  chargesEnabled: boolean;
  isPublished: boolean;
  productCount: number;
};

/**
 * Which screens exist yet. Flip an entry to true when its block ships:
 * Store setup and products (Block B/C), payments (Block D), publish (needs the public store page).
 */
const AVAILABLE: Record<ChecklistItemId, boolean> = {
  "store-setup": true,
  "first-product": true,
  "connect-payments": false,
  publish: true,
};

export function buildChecklist(input: ChecklistInput): {
  items: ChecklistItem[];
  next: ChecklistItem | null;
  doneCount: number;
} {
  const items: ChecklistItem[] = [
    {
      id: "store-setup",
      label: "Set up your store",
      description: "Add your photo, bio and social links.",
      // Done once the creator has personalized the store: a photo or a bio.
      done: Boolean(input.avatarUrl || input.bio?.trim()),
      available: AVAILABLE["store-setup"],
      href: "/dashboard/settings",
    },
    {
      id: "first-product",
      label: "Add your first product",
      description: "Sell a digital download, a link or a service.",
      done: input.productCount > 0,
      available: AVAILABLE["first-product"],
      href: "/dashboard/products/new",
    },
    {
      id: "connect-payments",
      label: "Connect payments",
      description: "Connect Stripe so buyers can pay you directly.",
      done: input.chargesEnabled,
      available: AVAILABLE["connect-payments"],
      href: "/dashboard/settings/payments",
    },
    {
      id: "publish",
      label: "Publish your store",
      description: "Make your store page public so buyers can find it.",
      done: input.isPublished,
      available: AVAILABLE.publish,
      href: "/dashboard#your-store-link",
    },
  ];

  return {
    items,
    next: items.find((item) => !item.done) ?? null,
    doneCount: items.filter((item) => item.done).length,
  };
}
