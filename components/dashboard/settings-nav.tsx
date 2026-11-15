"use client";

import { BadgeCheck, CreditCard, Store, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_SECTIONS, isSettingsSectionActive, type SettingsSectionId } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<SettingsSectionId, LucideIcon> = { store: Store, payments: CreditCard, plan: BadgeCheck, account: UserRound };

/** Settings sub-nav (DESIGN.md 10.2): a left column on desktop, a horizontal scroller on mobile. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          const active = isSettingsSectionActive(pathname, section.href);
          return (
            <li key={section.id} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-md px-3 text-base font-medium whitespace-nowrap transition-colors duration-(--dur-fast) lg:min-h-10",
                  active ? "bg-blue-soft text-ink" : "text-mute hover:bg-surface hover:text-ink",
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
