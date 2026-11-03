import { ArrowRight, CheckCircle2, CircleDashed, ExternalLink, Package, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { StorePreview, type PreviewProduct } from "@/components/dashboard/store-preview";
import { StoreSetupForm } from "@/components/dashboard/store-setup-form";
import { StripeConnectButtons } from "@/components/dashboard/stripe-connect-buttons";
import { PublishButton } from "@/components/dashboard/setup/publish-step";
import { SetupStepper } from "@/components/dashboard/setup/setup-stepper";
import { priceLabel } from "@/lib/products/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator, type CreatorStore } from "@/lib/auth/guards";
import { SETUP_PATH, currentStep, stepHref, type ChecklistItem } from "@/lib/dashboard/checklist";
import { loadSetupState, paymentsConnectable } from "@/lib/dashboard/setup-state";
import { isCurrencyLocked } from "@/lib/stores/currency-lock";
import { createProductAndEdit } from "@/lib/products/actions";
import type { CreatorProduct } from "@/lib/products/queries";
import { storeLink } from "@/lib/config";

// Setup wizard (D-045): the four first-run steps one at a time, with the stepper on top. Without a
// ?step it opens the next step to do, so finishing one step opens the next by itself.
export default function SetupPage({ searchParams }: PageProps<"/dashboard/setup">) {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <SetupContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SetupContent({ searchParams }: { searchParams: PageProps<"/dashboard/setup">["searchParams"] }) {
  const [{ store }, params] = await Promise.all([requireCreator(SETUP_PATH), searchParams]);
  const [{ checklist, products }, currencyLocked] = await Promise.all([loadSetupState(store), isCurrencyLocked(store.id).catch(() => true)]);
  const step = currentStep(checklist, typeof params.step === "string" ? params.step : undefined);
  const preview = toPreview(products);
  // The publish step shows what buyers will see: published products only.
  const published = toPreview(products.filter((product) => product.status === "published"));
  // After a step, go to the next one still to do; once everything is done, back to My Store.
  const continueHref = SETUP_PATH;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-h1">{checklist.complete ? "Your store is set up" : "Set up your store"}</h1>
        <p className="text-mute">
          {checklist.complete ? "Everything is done. You can still come back and change any step." : "One step at a time. Each step opens the next one when you finish it."}
        </p>
      </div>

      <SetupStepper checklist={checklist} current={step.id} />

      {step.id === "store-setup" && (
        <StoreSetupForm
          mode="setup"
          continueHref={continueHref}
          slug={store.slug}
          theme={store.theme}
          currencyLocked={currencyLocked}
          products={preview}
          initial={{
            name: store.name,
            bio: store.bio ?? "",
            avatarUrl: store.avatarUrl ?? "",
            currency: store.currency,
            socialLinks: store.socialLinks,
          }}
        />
      )}
      {step.id === "first-product" && <ProductStep step={step} products={products} currency={store.currency} />}
      {step.id === "connect-payments" && <PaymentsStep step={step} connected={store.stripeChargesEnabled} />}
      {step.id === "publish" && <PublishStep
          store={store}
          products={published}
          draftCount={products.length - published.length}
          complete={checklist.complete}
          othersOpen={checklist.items.some((item) => item.id !== "publish" && item.available && !item.done)}
        />}
    </div>
  );
}

function toPreview(products: CreatorProduct[]): PreviewProduct[] {
  return products.map(({ _id, title, coverUrl, buttonText, priceCents, salePriceCents }) => ({
    id: _id,
    title,
    coverUrl,
    buttonText,
    priceCents,
    salePriceCents: salePriceCents ?? null,
  }));
}

function NextLink({ label = "Continue" }: { label?: string }) {
  return (
    <Button asChild>
      <Link href={SETUP_PATH}>
        {label}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

function ProductStep({ step, products, currency }: { step: ChecklistItem; products: CreatorProduct[]; currency: string }) {
  return (
    <Card className="gap-6">
      <CardHeader>
        <h2 className="font-display text-h3">Add your first product</h2>
        <p className="text-sm text-mute">A guide, template, preset or any digital download. You can fill in the details now and publish it when it is ready.</p>
      </CardHeader>

      {products.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {products.map((product) => (
            <li key={product._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Package aria-hidden="true" className="size-5 shrink-0 text-mute" />
              <Link href={`/dashboard/products/${product._id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-blue">
                {product.title || "Untitled product"}
              </Link>
              <span className="text-sm text-mute tabular-nums">{priceLabel(product, currency)}</span>
              <Badge variant={product.status === "published" ? "live" : "draft"}>{product.status === "published" ? "Published" : "Draft"}</Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form action={createProductAndEdit}>
          <Button type="submit" variant={step.done ? "secondary" : "default"}>
            <Plus aria-hidden="true" />
            {step.done ? "Add another product" : "Create a digital product"}
          </Button>
        </form>
        {step.done && <NextLink />}
      </div>
      {!step.done && <p className="text-sm text-mute">After you save your product, the bar at the top of the dashboard takes you back to the next step.</p>}
    </Card>
  );
}

function PaymentsStep({ step, connected }: { step: ChecklistItem; connected: boolean }) {
  return (
    <Card className="gap-6">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Connect payments</h2>
          {/* Stripe test mode until the founder approves live mode (CLAUDE.md section 9). */}
          <Badge variant="testMode">Test mode</Badge>
        </div>
        <p className="text-sm text-mute">Buyers pay you directly through your own Stripe account. Pickstall never holds your money and takes 0% of your sales.</p>
      </CardHeader>

      <div className="flex flex-col gap-4 rounded-md border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3">
          {connected ? (
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
          ) : (
            <CircleDashed aria-hidden="true" className="size-5 shrink-0 text-mute" />
          )}
          <span className="flex flex-col">
            <span className="font-semibold">Stripe</span>
            <span className="text-sm text-mute">{connected ? "Connected. You can take payments." : "Not connected yet."}</span>
          </span>
        </p>
        <StripeConnectButtons connected={connected} testAvailable={paymentsConnectable()} continueHref={SETUP_PATH} />
      </div>

      {!step.available && (
        <p className="text-sm text-mute">
          Connecting Stripe is not switched on for this server yet, so this step does not hold up your setup. It turns on by itself once Stripe is
          configured.
        </p>
      )}
      {(connected || !step.available) && (
        <div>
          <NextLink />
        </div>
      )}
      <p className="text-sm text-mute">Stripe&apos;s card processing fees still apply.</p>
    </Card>
  );
}

function PublishStep({
  store,
  products,
  draftCount,
  complete,
  othersOpen,
}: {
  store: CreatorStore;
  products: PreviewProduct[];
  draftCount: number;
  complete: boolean;
  /** Steps before this one that still need doing. */
  othersOpen: boolean;
}) {
  const link = storeLink(store.slug);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Card className="gap-6">
        <CardHeader>
          <h2 className="font-display text-h3">{store.isPublished ? "Your store is live" : "Publish your store"}</h2>
          <p className="text-sm text-mute">
            {store.isPublished
              ? "Anyone with your link can see your store and buy your published products."
              : "Publishing makes your store page public. Only published products show on it, and you can unpublish any time in Settings."}
          </p>
        </CardHeader>
        <p className="rounded-md border border-line bg-bg-subtle px-4 py-3 font-medium break-all">{link}</p>
        {store.isPublished ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">
                {complete ? "Go to my dashboard" : "Back to My Store"}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/@${store.slug}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" />
                Open my store
              </Link>
            </Button>
          </div>
        ) : (
          <PublishButton />
        )}
        {othersOpen && !store.isPublished && (
          <p className="text-sm text-mute">
            Some steps are still open. You can publish now and finish them later from{" "}
            <Link href={stepHref("store-setup")} className="font-semibold text-blue underline underline-offset-4">
              the setup steps
            </Link>
            .
          </p>
        )}
      </Card>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-mute">This is what buyers will see</p>
        <StorePreview
          products={products}
          currency={store.currency}
          data={{
            slug: store.slug,
            name: store.name,
            bio: store.bio ?? "",
            avatarUrl: store.avatarUrl ?? "",
            socialLinks: store.socialLinks,
            themePreset: store.theme.preset,
            accent: store.theme.accent,
          }}
        />
        {products.length === 0 && draftCount > 0 && (
          <p className="text-center text-sm text-mute">
            Your {draftCount === 1 ? "draft product shows" : `${draftCount} draft products show`} here once you publish {draftCount === 1 ? "it" : "them"}.
          </p>
        )}
      </div>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading setup</span>
      <Skeleton className="h-16 w-72 rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
