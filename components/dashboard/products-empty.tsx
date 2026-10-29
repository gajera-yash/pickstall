import { ArrowRight, Package, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Empty Products tab (reference docs/ui-reference/dashboard.webp). */
export function ProductsEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span aria-hidden="true" className="relative flex size-16 items-center justify-center rounded-full bg-blue-soft text-blue">
        <Package className="size-8" />
        <Sparkles className="absolute -top-1 -right-2 size-4 text-blue" />
        <Sparkles className="absolute -bottom-1 -left-2 size-3 text-yellow" />
      </span>
      <h3 className="font-display text-h3">No products yet</h3>
      <p className="max-w-sm text-mute">Add a digital download, a link or a service to start selling on your store.</p>
      <Button asChild size="lg" className="mt-1">
        <Link href="/dashboard/products/new">
          <Plus aria-hidden="true" className="size-5" />
          Add your first product
        </Link>
      </Button>
      <Link href="/dashboard/products/new" className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:text-blue-hover">
        Learn about product types
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
