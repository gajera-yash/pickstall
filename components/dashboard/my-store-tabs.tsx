"use client";

import { Package, Palette } from "lucide-react";
import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MyStoreTab = "products" | "design";

/**
 * My Store tabs (PRD F8): Products and Page design. The open tab is kept in `?tab=` so a link
 * (for example from the checklist) can open Page design directly; switching does not reload.
 */
export function MyStoreTabs({ initialTab, products, design }: { initialTab: MyStoreTab; products: ReactNode; design: ReactNode }) {
  const remember = (value: string) => {
    const url = new URL(window.location.href);
    if (value === "products") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <Tabs defaultValue={initialTab} onValueChange={remember}>
      <TabsList aria-label="My Store">
        <TabsTrigger value="products">
          <Package aria-hidden="true" />
          Products
        </TabsTrigger>
        <TabsTrigger value="design">
          <Palette aria-hidden="true" />
          Page design
        </TabsTrigger>
      </TabsList>
      <TabsContent value="products">{products}</TabsContent>
      <TabsContent value="design">{design}</TabsContent>
    </Tabs>
  );
}
