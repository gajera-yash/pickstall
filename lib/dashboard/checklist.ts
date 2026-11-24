// First-run setup (docs/DECISIONS.md D-009, D-045, DESIGN.md 10.8): four steps, worked through one
// by one on /dashboard/setup. Every step's state comes from the store's own data, so nothing extra
// is stored.

export type ChecklistItemId = "store-setup" | "first-product" | "connect-payments" | "publish";

export const SETUP_PATH = "/dashboard/setup";

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  description: string;
  done: boolean;
  /**
   * False when this server cannot do the step yet (payments without a way to connect Stripe). Such a
   * step is shown, but it does not block setup; once the server can do it, it counts again.
   */
  available: boolean;
  href: string;
};

export type ChecklistInput = {
  bio: string | null;
  avatarUrl: string | null;
  /** Store details saved at least once (D-091). */
  profileSaved?: boolean;
  chargesEnabled: boolean;
  isPublished: boolean;
  productCount: number;
  /** True when this server can connect a Stripe account (test account now, Connect OAuth later). */
  paymentsAvailable: boolean;
};

export type Checklist = {
  items: ChecklistItem[];
  /** The first step that still needs doing; null when setup is complete. */
  next: ChecklistItem | null;
  doneCount: number;
  /** How many steps count towards setup on this server. */
  requiredCount: number;
  /** Every step that counts is done: My Store switches from the checklist to the full dashboard. */
  complete: boolean;
};

export const stepHref = (id: ChecklistItemId) => `${SETUP_PATH}?step=${id}`;

export function buildChecklist(input: ChecklistInput): Checklist {
  const items: ChecklistItem[] = [
    {
      id: "store-setup",
      label: "Set up your store",
      description: "Your name, photo, bio, theme and social links.",
      // Done once the creator has saved this step (photo and bio are optional, D-091), or for stores
      // set up before that, once it has a photo or a bio.
      done: Boolean(input.profileSaved || input.avatarUrl || input.bio?.trim()),
      available: true,
      href: stepHref("store-setup"),
    },
    {
      id: "first-product",
      label: "Add your first product",
      description: "A guide, template, preset or any digital download.",
      done: input.productCount > 0,
      available: true,
      href: stepHref("first-product"),
    },
    {
      id: "connect-payments",
      label: "Connect payments",
      description: "Connect Stripe or PayPal so buyers pay you directly.",
      done: input.chargesEnabled,
      available: input.paymentsAvailable || input.chargesEnabled,
      href: stepHref("connect-payments"),
    },
    {
      id: "publish",
      label: "Publish your store",
      description: "Make your store page public and share your link.",
      done: input.isPublished,
      available: true,
      href: stepHref("publish"),
    },
  ];

  const counted = items.filter((item) => item.available);
  const next = counted.find((item) => !item.done) ?? null;
  return {
    items,
    next,
    doneCount: counted.filter((item) => item.done).length,
    requiredCount: counted.length,
    complete: next === null,
  };
}

/** The step the wizard shows: the one asked for in the URL if it exists, else the next one to do. */
export function currentStep(checklist: Checklist, requested: string | undefined): ChecklistItem {
  const asked = checklist.items.find((item) => item.id === requested);
  // After setup, the wizard rests on its last step (publish).
  const last = checklist.items[checklist.items.length - 1] as ChecklistItem;
  return asked ?? checklist.next ?? last;
}
