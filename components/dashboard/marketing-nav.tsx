"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MARKETING_SECTIONS, isMarketingSectionActive } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

/**
 * Marketing sub-nav (D-129): the overview and one page per tool, as tabs under the page title. On a
 * phone it scrolls sideways; the open page is marked for screen readers too.
 */
export function MarketingNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketing">
      <ul className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        {MARKETING_SECTIONS.map((section) => {
          const active = isMarketingSectionActive(pathname, section.href);
          return (
            <li key={section.id} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-fast)",
                  active ? "border-blue text-ink" : "border-transparent text-mute hover:text-ink",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
