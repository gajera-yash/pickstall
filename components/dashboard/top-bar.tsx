"use client";

import { ChevronRight, ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { breadcrumbFor } from "@/lib/dashboard/nav";

type Props = { displayName: string; email: string | null; isPublished: boolean };

/**
 * Dashboard top bar (PRD F8, DESIGN.md 5 and 9.8): breadcrumb with the store status, "View my store"
 * (Coming soon until the public store page exists) and the account menu. 56px high.
 */
export function TopBar({ displayName, email, isPublished }: Props) {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <Link href="/dashboard" aria-label="Pickstall, go to My Store" className="shrink-0 rounded-sm md:hidden">
        <Wordmark className="h-7" />
      </Link>

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.href} className={last ? "flex min-w-0 items-center gap-1.5" : "hidden items-center gap-1.5 sm:flex"}>
                {last ? (
                  <span aria-current="page" className="truncate font-semibold text-ink">
                    {crumb.label}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.href} className="rounded-sm text-mute hover:text-ink">
                      {crumb.label}
                    </Link>
                    <ChevronRight aria-hidden="true" className="size-4 text-mute" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}

      <div className="ml-auto flex items-center gap-2">
        {/* Not a link yet: the public store page arrives in R4. */}
        <span
          aria-disabled="true"
          className="hidden h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold text-mute lg:inline-flex"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          View my store
          <Badge variant="soon">Coming soon</Badge>
        </span>
        <AccountMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}

function AccountMenu({ displayName, email }: { displayName: string; email: string | null }) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-bg-subtle data-[state=open]:bg-bg-subtle"
      >
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-blue-soft font-display text-base font-semibold text-blue">
          {initial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{displayName}</span>
          {email && <span className="truncate text-sm font-normal text-mute">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/account">
            <UserRound aria-hidden="true" />
            Account settings
          </Link>
        </DropdownMenuItem>
        {/* The menu would unmount the form before a native submit, so the item submits it itself
            and keeps the menu open until the redirect. */}
        <form ref={signOutForm} action={signOut} />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            signOutForm.current?.requestSubmit();
          }}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
