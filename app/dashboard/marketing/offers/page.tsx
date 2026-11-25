import { Check, Minus, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BUMP_HOW_IT_WORKS, HowItWorks, UPSELL_HOW_IT_WORKS } from "@/components/dashboard/how-it-works";
import { ListCard } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { listProducts } from "@/lib/products/queries";

// Offers (D-129): what order bumps, upsells and downsells are, and which products have one. They
// are set on each product (D-089, D-099, D-115); this page explains them and links to each editor.
export default function OffersPage() {
  return (
    <>
      <PageHeader title="Offers" description="Sell more to people who are already buying: a one-tick extra at checkout, and a special offer right after they pay." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <OffersContent />
      </Suspense>
    </>
  );
}

function Mark({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-mint">
      <Check aria-hidden="true" className="size-4" />
      <span className="sr-only">{label} set</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-mute">
      <Minus aria-hidden="true" className="size-4" />
      <span className="sr-only">No {label.toLowerCase()}</span>
    </span>
  );
}

async function OffersContent() {
  const { store } = await requireUnlockedCreator("/dashboard/marketing/offers");
  const products = (await listProducts(store.id)).filter((product) => product.status !== "archived" && product.type !== "lead_magnet");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-blue-soft text-blue">
            <ShoppingCart className="size-5" />
          </span>
          <h2 className="font-display text-h3">Order bump</h2>
          <p className="text-sm text-mute">One more product at checkout, added with a single tick. Set it in a product&apos;s Checkout step (or the Publish step of a course or call).</p>
          <HowItWorks content={BUMP_HOW_IT_WORKS} />
        </Card>
        <Card className="gap-3">
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-blue-soft text-blue">
            <Sparkles className="size-5" />
          </span>
          <h2 className="font-display text-h3">Upsell and downsell</h2>
          <p className="text-sm text-mute">A special offer on the thank-you page right after a purchase, and a smaller one if they say no. Set them next to the order bump.</p>
          <HowItWorks content={UPSELL_HOW_IT_WORKS} />
        </Card>
      </div>

      <section aria-labelledby="offers-products" className="flex flex-col gap-3">
        <h2 id="offers-products" className="font-display text-h3">
          Your products
        </h2>
        {products.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No products yet">
            Add a product first, then give it an offer.
          </EmptyState>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead>Order bump</TableHead>
                  <TableHead>Upsell</TableHead>
                  <TableHead>Downsell</TableHead>
                  <TableHead className="sr-only">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell className="max-w-64 truncate font-semibold">{product.title}</TableCell>
                    <TableCell>
                      <Mark on={Boolean(product.bump)} label="Order bump" />
                    </TableCell>
                    <TableCell>
                      <Mark on={Boolean(product.upsell)} label="Upsell" />
                    </TableCell>
                    <TableCell>
                      <Mark on={Boolean(product.downsell)} label="Downsell" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/products/${product._id}`} className="text-sm font-semibold text-blue underline underline-offset-4">
                        Edit offers
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )}
      </section>
    </div>
  );
}
