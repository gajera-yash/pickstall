"use client";

import { Settings, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_SECTIONS, isSectionActive, type DashboardSectionId } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardSectionId, LucideIcon> = { store: Store, income: Wallet, customers: Users, settings: Settings };

/**
 * DESIGN.md 5.3 and 9.8: a sidebar on desktop, a bottom tab bar on mobile (4 items).
 * Active item: blue-soft background, ink text, a 3px blue bar, and aria-current.
 */
export function DashboardNav({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {DASHBOARD_SECTIONS.map((section) => {
            const Icon = ICONS[section.id];
            const active = isSectionActive(pathname, section.href);
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    active ? "text-blue" : "text-mute",
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard">
      <ul className="flex flex-col gap-1">
        {DASHBOARD_SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          const active = isSectionActive(pathname, section.href);
          return (
            <li key={section.id}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-md px-3 text-base font-medium",
                  active
                    ? "bg-blue-soft text-ink before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-blue"
                    : "text-mute hover:bg-blue-soft hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
