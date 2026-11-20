"use client";

import {
  BarChart3,
  House,
  LineChart,
  Lock,
  Megaphone,
  MoreHorizontal,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BOTTOM_BAR_SECTIONS, DASHBOARD_SECTIONS, isSectionActive, type DashboardSectionId } from "@/lib/dashboard/nav";
import { LOCKED_HINT, isSectionLocked } from "@/lib/dashboard/setup-lock";
import { cn } from "@/lib/utils";

export const SECTION_ICONS: Record<DashboardSectionId, LucideIcon> = {
  store: House,
  products: Package,
  orders: ShoppingBag,
  customers: Users,
  reviews: Star,
  income: BarChart3,
  marketing: Megaphone,
  analytics: LineChart,
  settings: Settings,
};

/**
 * Dashboard navigation (D-029, reference docs/ui-reference/dashboard.webp). Desktop: a sidebar list,
 * 44px rows, active = blue-soft pill with a blue icon and a blue bar on the left edge. Mobile: a bottom
 * bar with the first four sections and "More" for the rest. Until setup is done (`unlocked` false),
 * every section but My Store shows a lock and is not a link (D-079); the pages redirect too.
 */
export function DashboardNav({ variant, unlocked }: { variant: "sidebar" | "bottom"; unlocked: boolean }) {
  const pathname = usePathname();
  const locked = (id: DashboardSectionId) => isSectionLocked(id, unlocked);

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
            if (locked(section.id)) {
              return (
                <li key={section.id}>
                  <LockedItem label={section.label} side="top" className={cn(tabClass(false), "cursor-not-allowed")}>
                    <span className="relative">
                      <Icon aria-hidden="true" className="size-6" />
                      <Lock aria-hidden="true" className="absolute -right-1.5 -bottom-1 size-3.5 rounded-full bg-surface" />
                    </span>
                    {section.label}
                  </LockedItem>
                </li>
              );
            }
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
                  if (locked(section.id)) {
                    return (
                      <DropdownMenuItem key={section.id} disabled>
                        <Icon aria-hidden="true" />
                        {section.label}
                        <Lock aria-hidden="true" className="ml-auto" />
                        <span className="sr-only">, locked. {LOCKED_HINT}.</span>
                      </DropdownMenuItem>
                    );
                  }
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
          if (locked(section.id)) {
            return (
              <li key={section.id}>
                <LockedItem
                  label={section.label}
                  className="flex h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-base font-medium text-mute"
                >
                  <Icon aria-hidden="true" className="size-5 text-mute" />
                  <span className="flex-1">{section.label}</span>
                  <Lock aria-hidden="true" className="size-4 text-mute" />
                </LockedItem>
              </li>
            );
          }
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

/**
 * A locked nav section (D-079): looks like the item with a lock, is not a link, and says why in a
 * tooltip (hover or keyboard focus) and to screen readers. It stays focusable so the hint is reachable.
 */
function LockedItem({ label, className, side = "right", children }: { label: string; className: string; side?: "right" | "top"; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="link" aria-disabled="true" tabIndex={0} aria-label={`${label}, locked. ${LOCKED_HINT}.`} className={className}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side}>{LOCKED_HINT}</TooltipContent>
    </Tooltip>
  );
}
