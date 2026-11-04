"use client";

import { BarChart3, Link2, Package, Palette, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { MyStoreTab } from "@/lib/dashboard/nav";

export type { MyStoreTab };

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
    <Tabs defaultValue={initialTab} onValueChange={remember} className="gap-0 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-col border-b border-line px-4 sm:px-6 lg:h-14 lg:flex-row lg:items-center lg:justify-between">
        <TabsList aria-label="My Store" className="border-b-0 lg:h-full">
          <TabsTrigger value="products" className="lg:h-full">
            <Package aria-hidden="true" />
            Products
          </TabsTrigger>
          <TabsTrigger value="design" className="lg:h-full">
            <Palette aria-hidden="true" />
            Store design
          </TabsTrigger>
          <TabsTrigger value="links" className="lg:h-full">
            <Link2 aria-hidden="true" />
            Links
          </TabsTrigger>
          <TabsTrigger value="analytics" className="lg:h-full">
            <BarChart3 aria-hidden="true" />
            Analytics
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2.5 py-3 lg:py-0">
          <InputGroup className="h-9 min-w-0 flex-1 sm:w-60 lg:w-64 lg:flex-none">
            <InputGroupInput
              type="search"
              aria-label="Search products"
              placeholder="Search products..."
              disabled={productCount === 0}
              title={productCount === 0 ? "Add a product first" : undefined}
              className="text-sm"
            />
            <InputGroupAddon align="inline-start" className="pl-3 pr-0">
              <Search aria-hidden="true" className="size-4 text-mute" />
            </InputGroupAddon>
          </InputGroup>
          <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 px-3.5">
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
