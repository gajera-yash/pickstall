import { Suspense } from "react";

import { AutomationTabs } from "@/components/dashboard/automation-tabs";
import { CartReminderSettings } from "@/components/dashboard/cart-reminder-settings";
import { WelcomeEmailForm } from "@/components/dashboard/list-email-composer";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewRequestSettings } from "@/components/dashboard/review-request-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { cartStats, findCartSettings } from "@/lib/abandoned-cart/queries";
import { findWelcomeEmail } from "@/lib/broadcasts/queries";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { can } from "@/lib/plans/access";
import { findReviewRequestSettings, reviewRequestsSent } from "@/lib/review-request/queries";

// Automatic emails (D-129): the welcome email (D-095), the abandoned cart reminder (D-096) and the
// review request (D-117), one tab each. Only the session's own store.
const WELCOME_DRAFT = "Hi {{customer_name}},\n\nThanks for joining my list! I'll share new guides and offers here from time to time.";

export default function AutomationsPage() {
  return (
    <>
      <PageHeader title="Automations" description="Emails that go out on their own: a welcome for new subscribers, a reminder for unfinished checkouts and a review request after a purchase." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <AutomationsContent />
      </Suspense>
    </>
  );
}

async function AutomationsContent() {
  const { store } = await requireUnlockedCreator("/dashboard/marketing/automations");
  const [welcome, cart, stats, review, reviewSent] = await Promise.all([
    findWelcomeEmail(store.id),
    findCartSettings(store.id),
    cartStats(store.id),
    findReviewRequestSettings(store.id),
    reviewRequestsSent(store.id),
  ]);
  const locked = !can(store.access, "automations");
  return (
    <AutomationTabs
      welcome={<WelcomeEmailForm storeName={store.name} initial={welcome ?? { enabled: false, subject: `Welcome to ${store.name}`, body: WELCOME_DRAFT }} locked={locked} />}
      cart={<CartReminderSettings storeName={store.name} initial={cart} stats={stats} locked={locked} />}
      review={<ReviewRequestSettings storeName={store.name} initial={review} sent={reviewSent} locked={locked} />}
    />
  );
}
