"use client";

import { MailCheck, ShoppingBag, Star } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The three automatic emails (D-129), one tab each; every tab keeps its unsaved text while another is open. */
export function AutomationTabs({ welcome, cart, review }: { welcome: ReactNode; cart: ReactNode; review: ReactNode }) {
  const [tab, setTab] = useState("welcome");
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <TabsList aria-label="Automatic emails" className="overflow-x-auto">
        <TabsTrigger value="welcome">
          <MailCheck aria-hidden="true" />
          Welcome email
        </TabsTrigger>
        <TabsTrigger value="cart">
          <ShoppingBag aria-hidden="true" />
          Abandoned cart
        </TabsTrigger>
        <TabsTrigger value="review">
          <Star aria-hidden="true" />
          Review request
        </TabsTrigger>
      </TabsList>
      <TabsContent value="welcome" forceMount className="data-[state=inactive]:hidden">
        {welcome}
      </TabsContent>
      <TabsContent value="cart" forceMount className="data-[state=inactive]:hidden">
        {cart}
      </TabsContent>
      <TabsContent value="review" forceMount className="data-[state=inactive]:hidden">
        {review}
      </TabsContent>
    </Tabs>
  );
}
