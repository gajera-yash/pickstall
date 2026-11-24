"use client";

import { Activity, BarChart3, CreditCard, KeyRound, Mail, Megaphone, Menu, Package, ReceiptText, ScrollText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/growth", label: "Growth", icon: Megaphone },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/creators", label: "Creators", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/health", label: "Health", icon: Activity },
  { href: "/admin/account", label: "Account", icon: KeyRound },
] as const;

/** The admin sections (D-104, D-116): a column in the sidebar. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors duration-(--dur-fast)", active ? "bg-blue-soft text-blue" : "text-mute hover:bg-bg-subtle hover:text-ink")}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones and tablets: a menu button that opens the same sections in a sheet. */
export function AdminMobileNav({ username, signOut }: { username: string; signOut: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label="Open the admin menu" onClick={() => setOpen(true)}>
        <Menu aria-hidden="true" className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Admin</SheetTitle>
            <SheetDescription>Signed in as {username}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <AdminNav onNavigate={() => setOpen(false)} />
            <div className="border-t border-line pt-4">{signOut}</div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
