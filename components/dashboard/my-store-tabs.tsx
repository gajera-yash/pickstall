"use client";

import { BarChart3, Link2, Package, Palette, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const MY_STORE_TABS = ["products", "design", "links", "analytics"] as const;
export type MyStoreTab = (typeof MY_STORE_TABS)[number];

type Props = { initialTab: MyStoreTab; products: ReactNode; design: ReactNode; links: ReactNode; analytics: ReactNode; productCount: number };

/**
 * My Store tabs (reference docs/ui-reference/dashboard.webp): Products, Store design, Links and
 * Analytics, with product search and "Add product" on the right. The open tab is kept in `?tab=`
 * so a link can open a tab directly; switching does not reload.
 */
export function MyStoreTabs({ initialTab, products, design, links, analytics, productCount }: Props) {
  const remember = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "products") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <Tabs defaultValue={initialTab} onValueChange={remember} className="gap-0 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 pt-2 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <TabsList aria-label="My Store" className="border-b-0">
          <TabsTrigger value="products">
            <Package aria-hidden="true" />
            Products
          </TabsTrigger>
          <TabsTrigger value="design">
            <Palette aria-hidden="true" />
            Store design
          </TabsTrigger>
          <TabsTrigger value="links">
            <Link2 aria-hidden="true" />
            Links
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 aria-hidden="true" />
            Analytics
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 pb-3 lg:py-2">
          <label className="relative flex min-w-0 flex-1 lg:w-56 lg:flex-none">
            <span className="sr-only">Search products</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
            <input
              type="search"
              placeholder="Search products..."
              disabled={productCount === 0}
              title={productCount === 0 ? "Add a product first" : undefined}
              className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-mute disabled:cursor-not-allowed disabled:bg-bg-subtle"
            />
          </label>
          <Button asChild size="sm" className="h-10 shrink-0">
            <Link href="/dashboard/products/new">
              <Plus aria-hidden="true" className="size-4" />
              Add product
            </Link>
          </Button>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <TabsContent value="products">{products}</TabsContent>
        <TabsContent value="design">{design}</TabsContent>
        <TabsContent value="links">{links}</TabsContent>
        <TabsContent value="analytics">{analytics}</TabsContent>
      </div>
    </Tabs>
  );
}
