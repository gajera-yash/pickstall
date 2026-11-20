"use client";

import { Activity, BarChart3, Mail, Package, ReceiptText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/creators", label: "Creators", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/health", label: "Health", icon: Activity },
] as const;

/** The admin sub-nav (D-104): a row on phones, a column on desktop. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-fast)", active ? "bg-blue-soft text-blue" : "text-mute hover:bg-bg-subtle hover:text-ink")}
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
