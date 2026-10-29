"use client";

import {
  BarChart3,
  House,
  LineChart,
  Megaphone,
  MoreHorizontal,
  Package,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BOTTOM_BAR_SECTIONS, DASHBOARD_SECTIONS, isSectionActive, type DashboardSectionId } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

export const SECTION_ICONS: Record<DashboardSectionId, LucideIcon> = {
  store: House,
  products: Package,
  orders: ShoppingBag,
  customers: Users,
  income: BarChart3,
  marketing: Megaphone,
  analytics: LineChart,
  settings: Settings,
};

/**
 * Dashboard navigation (D-029, reference docs/ui-reference/dashboard.webp). Desktop: a sidebar list,
 * 44px rows, active = blue-soft pill with a blue icon and a blue bar on the left edge. Mobile: a bottom
 * bar with the first four sections and "More" for the rest.
 */
export function DashboardNav({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    const main = DASHBOARD_SECTIONS.slice(0, BOTTOM_BAR_SECTIONS);
    const more = DASHBOARD_SECTIONS.slice(BOTTOM_BAR_SECTIONS);
    const moreActive = more.some((section) => isSectionActive(pathname, section.href));
    const tabClass = (active: boolean) =>
      cn(
        "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold",
        active ? "text-blue before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-blue" : "text-mute",
      );

    return (
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {main.map((section) => {
            const Icon = SECTION_ICONS[section.id];
            const active = isSectionActive(pathname, section.href);
            return (
              <li key={section.id}>
                <Link href={section.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <Icon aria-hidden="true" className="size-6" />
                  {section.label}
                </Link>
              </li>
            );
          })}
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(tabClass(moreActive), "cursor-pointer")}>
                <MoreHorizontal aria-hidden="true" className="size-6" />
                More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                {more.map((section) => {
                  const Icon = SECTION_ICONS[section.id];
                  const active = isSectionActive(pathname, section.href);
                  return (
                    <DropdownMenuItem key={section.id} asChild>
                      <Link href={section.href} aria-current={active ? "page" : undefined} className={cn(active && "text-blue")}>
                        <Icon aria-hidden="true" />
                        {section.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Dashboard">
      <ul className="flex flex-col gap-1">
        {DASHBOARD_SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section.id];
          const active = isSectionActive(pathname, section.href);
          return (
            <li key={section.id} className="relative">
              {active && <span aria-hidden="true" className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-blue" />}
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors duration-(--dur-fast)",
                  active ? "bg-blue-soft font-semibold text-blue" : "text-ink/80 hover:bg-bg-subtle hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-5", active ? "text-blue" : "text-mute")} />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
