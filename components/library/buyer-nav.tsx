"use client";

import { LayoutDashboard, Library, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** The buyer area's two places, with the current one marked. */
export function BuyerTabs() {
  const pathname = usePathname();
  const items = [
    { href: "/library", label: "My library", icon: Library, active: pathname === "/library" || pathname.startsWith("/library/") },
    { href: "/account", label: "Account", icon: UserRound, active: pathname === "/account" },
  ];
  return (
    <nav aria-label="Your area" className="flex items-center gap-1">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow sm:px-4",
            active ? "bg-blue-soft text-blue" : "text-mute hover:bg-bg-subtle hover:text-ink",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** The signed-in person's menu: who they are, their dashboard if they also sell, and sign out. */
export function BuyerMenu({ email, name, isCreator }: { email: string | null; name: string | null; isCreator: boolean }) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Your account menu"
        className="flex size-10 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-surface transition-transform duration-(--dur-fast) hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow motion-reduce:hover:scale-100"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {name && <span className="truncate font-semibold text-ink">{name}</span>}
          <span className="truncate text-xs font-normal text-mute">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/library">
            <Library aria-hidden="true" />
            My library
          </Link>
        </DropdownMenuItem>
        {isCreator && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LayoutDashboard aria-hidden="true" />
              Creator dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden="true" />
            Account and data
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
