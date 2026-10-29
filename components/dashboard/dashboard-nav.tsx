"use client";

import { Settings, Store, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_SECTIONS, isSectionActive, type DashboardSectionId } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardSectionId, LucideIcon> = { store: Store, income: Wallet, customers: Users, settings: Settings };

/**
 * DESIGN.md 5 and 9.8: a sidebar on desktop, a bottom tab bar on mobile (4 items, D-023).
 * Sidebar items are 40px; active = blue-soft background, ink text, medium weight, aria-current.
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
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold",
                    active ? "text-blue before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-full before:bg-blue" : "text-mute",
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
                  "flex h-10 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors duration-(--dur-fast)",
                  active ? "bg-blue-soft text-ink" : "text-mute hover:bg-bg-subtle hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-5", active && "text-blue")} />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
